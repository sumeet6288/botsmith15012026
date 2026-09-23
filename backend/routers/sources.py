from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timezone
from models import Source, SourceCreate, SourceResponse
from auth import get_current_user, get_current_user, User
from services.document_processor import DocumentProcessor
from services.website_scraper import WebsiteScraper
from services.rag_service import RAGService
from services.plan_service import plan_service
import logging
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sources", tags=["sources"])
db_instance = None
rag_service = None


def init_router(db: AsyncIOMotorDatabase):
    """Initialize router with database instance"""
    global db_instance, rag_service
    db_instance = db
    rag_service = RAGService()


async def verify_chatbot_ownership(chatbot_id: str, user_id: str):
    """Verify that the chatbot belongs to the user"""
    chatbot = await db_instance.chatbots.find_one({
        "id": chatbot_id,
        "user_id": user_id
    })
    if not chatbot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chatbot not found"
        )
    return chatbot


@router.get("/chatbot/{chatbot_id}", response_model=List[SourceResponse])
async def get_sources(
    chatbot_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all sources for a chatbot"""
    try:
        # Verify ownership
        await verify_chatbot_ownership(chatbot_id, current_user.id)
        
        sources = await db_instance.sources.find(
            {"chatbot_id": chatbot_id}
        ).to_list(length=None)
        
        return [SourceResponse(**source) for source in sources]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sources: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sources"
        )


@router.post("/chatbot/{chatbot_id}/file", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def upload_file_source(
    chatbot_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a file as a training source (20MB total storage per agent)"""
    try:
        # Check plan limits for file uploads
        limit_check = await plan_service.check_limit(current_user.id, "file_uploads")
        if limit_check["reached"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "File upload limit reached for your plan",
                    "current": limit_check["current"],
                    "max": limit_check["max"],
                    "upgrade_required": True
                }
            )
        
        # Verify ownership
        await verify_chatbot_ownership(chatbot_id, current_user.id)
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        # Enforce a 20 MB TOTAL file-storage limit per agent/chatbot.
        MAX_AGENT_STORAGE = 20 * 1024 * 1024  # 20 MiB in bytes

        # Calculate storage already used by this chatbot's file sources.
        # New uploads store the exact byte count in file_size.
        # Legacy sources may not have file_size, so fall back to parsing
        # their existing formatted size value when available.
        existing_sources = await db_instance.sources.find(
            {
                "chatbot_id": chatbot_id,
                "type": "file"
            },
            {
                "file_size": 1,
                "size": 1
            }
        ).to_list(length=None)

        existing_storage = 0

        for existing_source in existing_sources:
            stored_size = existing_source.get("file_size")

            if isinstance(stored_size, (int, float)) and stored_size >= 0:
                existing_storage += int(stored_size)
                continue

            # Backward compatibility for older records that only have
            # a formatted size such as "5.2 MB".
            formatted_size = existing_source.get("size")
            if isinstance(formatted_size, str):
                try:
                    parts = formatted_size.strip().split()
                    if len(parts) == 2:
                        value = float(parts[0])
                        unit = parts[1].upper()
                        multipliers = {
                            "B": 1,
                            "KB": 1024,
                            "MB": 1024 ** 2,
                            "GB": 1024 ** 3,
                            "TB": 1024 ** 4
                        }
                        if unit in multipliers and value >= 0:
                            existing_storage += int(value * multipliers[unit])
                except (ValueError, TypeError):
                    pass

        new_total = existing_storage + file_size

        if new_total > MAX_AGENT_STORAGE:
            remaining_storage = max(0, MAX_AGENT_STORAGE - existing_storage)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"Agent file storage limit of 20MB exceeded. "
                    f"Current storage: {DocumentProcessor.format_size(existing_storage)}, "
                    f"file size: {DocumentProcessor.format_size(file_size)}, "
                    f"remaining: {DocumentProcessor.format_size(remaining_storage)}, "
                    f"maximum: 20MB total per agent."
                )
            )

        # Create source entry
        source = Source(
            chatbot_id=chatbot_id,
            type="file",
            name=file.filename,
            file_size=file_size,
            size=DocumentProcessor.format_size(file_size),
            status="processing"
        )

        await db_instance.sources.insert_one(source.model_dump())

        # Increment usage count
        await plan_service.increment_usage(current_user.id, "file_uploads")
        
        # Process file in background
        async def process_file():
            try:
                content = DocumentProcessor.process_file(file.filename, file_content)
                
                await db_instance.sources.update_one(
                    {"id": source.id},
                    {"$set": {
                        "content": content,
                        "status": "completed"
                    }}
                )
                
                # Process with RAG (chunking + embeddings + vector storage)
                logger.info(f"Processing document with RAG for source {source.id}")
                rag_result = await rag_service.process_document(
                    text=content,
                    chatbot_id=chatbot_id,
                    source_id=source.id,
                    source_type="file",
                    filename=file.filename,
                    use_paragraph_chunking=True
                )
                
                if rag_result.get("success"):
                    logger.info(f"RAG processing successful: {rag_result.get('chunks_created')} chunks created")
                else:
                    logger.error(f"RAG processing failed: {rag_result.get('error')}")
                
                # Update chatbot last_trained timestamp
                await db_instance.chatbots.update_one(
                    {"id": chatbot_id},
                    {"$set": {"last_trained": datetime.now(timezone.utc)}}
                )
            except Exception as e:
                logger.error(f"Error processing file: {str(e)}")
                await db_instance.sources.update_one(
                    {"id": source.id},
                    {"$set": {
                        "status": "failed",
                        "error_message": str(e)
                    }}
                )
        
        # Start background task
        asyncio.create_task(process_file())
        
        return SourceResponse(**source.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file"
        )


@router.post("/chatbot/{chatbot_id}/website", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def add_website_source(
    chatbot_id: str,
    url: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Add a website as a training source"""
    try:
        # Check plan limits for website sources
        limit_check = await plan_service.check_limit(current_user.id, "website_sources")
        if limit_check["reached"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Website source limit reached for your plan",
                    "current": limit_check["current"],
                    "max": limit_check["max"],
                    "upgrade_required": True
                }
            )
        
        # Verify ownership
        await verify_chatbot_ownership(chatbot_id, current_user.id)
        
        # Create source entry
        source = Source(
            chatbot_id=chatbot_id,
            type="website",
            name=url,
            url=url,
            status="processing"
        )
        
        await db_instance.sources.insert_one(source.model_dump())
        
        # Increment usage count
        await plan_service.increment_usage(current_user.id, "website_sources")
        
        # Scrape website in background
        async def scrape_website():
            try:
                content = WebsiteScraper.scrape_url(url)
                
                await db_instance.sources.update_one(
                    {"id": source.id},
                    {"$set": {
                        "content": content,
                        "status": "completed"
                    }}
                )
                
                # Process with RAG
                logger.info(f"Processing website with RAG for source {source.id}")
                rag_result = await rag_service.process_document(
                    text=content,
                    chatbot_id=chatbot_id,
                    source_id=source.id,
                    source_type="website",
                    filename=url,
                    use_paragraph_chunking=True
                )
                
                if rag_result.get("success"):
                    logger.info(f"RAG processing successful: {rag_result.get('chunks_created')} chunks created")
                else:
                    logger.error(f"RAG processing failed: {rag_result.get('error')}")
                
                # Update chatbot last_trained timestamp
                await db_instance.chatbots.update_one(
                    {"id": chatbot_id},
                    {"$set": {"last_trained": datetime.now(timezone.utc)}}
                )
            except Exception as e:
                logger.error(f"Error scraping website: {str(e)}")
                await db_instance.sources.update_one(
                    {"id": source.id},
                    {"$set": {
                        "status": "failed",
                        "error_message": str(e)
                    }}
                )
        
        # Start background task
        asyncio.create_task(scrape_website())
        
        return SourceResponse(**source.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding website: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add website"
        )


@router.post("/chatbot/{chatbot_id}/text", response_model=SourceResponse, status_code=status.HTTP_201_CREATED)
async def add_text_source(
    chatbot_id: str,
    name: str = Form(...),
    content: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Add text content as a training source"""
    try:
        # Check plan limits for text sources
        limit_check = await plan_service.check_limit(current_user.id, "text_sources")
        if limit_check["reached"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Text source limit reached for your plan",
                    "current": limit_check["current"],
                    "max": limit_check["max"],
                    "upgrade_required": True
                }
            )
        
        # Verify ownership
        await verify_chatbot_ownership(chatbot_id, current_user.id)
        
        # Create source entry
        source = Source(
            chatbot_id=chatbot_id,
            type="text",
            name=name,
            content=content,
            status="completed"
        )
        
        await db_instance.sources.insert_one(source.model_dump())
        
        # Increment usage count
        await plan_service.increment_usage(current_user.id, "text_sources")
        
        # Process with RAG immediately (text is already available)
        async def process_text():
            try:
                logger.info(f"Processing text content with RAG for source {source.id}")
                rag_result = await rag_service.process_document(
                    text=content,
                    chatbot_id=chatbot_id,
                    source_id=source.id,
                    source_type="text",
                    filename=name,
                    use_paragraph_chunking=True
                )
                
                if rag_result.get("success"):
                    logger.info(f"RAG processing successful: {rag_result.get('chunks_created')} chunks created")
                else:
                    logger.error(f"RAG processing failed: {rag_result.get('error')}")
            except Exception as e:
                logger.error(f"Error in RAG processing for text: {str(e)}")
        
        # Start background task
        asyncio.create_task(process_text())
        
        # Update chatbot last_trained timestamp
        await db_instance.chatbots.update_one(
            {"id": chatbot_id},
            {"$set": {"last_trained": datetime.now(timezone.utc)}}
        )
        
        return SourceResponse(**source.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding text: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add text"
        )


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a source"""
    try:
        # Get source
        source = await db_instance.sources.find_one({"id": source_id})
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source not found"
            )
        
        # Verify ownership through chatbot
        await verify_chatbot_ownership(source["chatbot_id"], current_user.id)
        
        # Delete from RAG vector store
        try:
            await rag_service.delete_source(source["chatbot_id"], source_id)
            logger.info(f"Deleted RAG data for source {source_id}")
        except Exception as e:
            logger.error(f"Error deleting RAG data: {str(e)}")
        
        # Delete source from database
        await db_instance.sources.delete_one({"id": source_id})
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting source: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete source"
        )

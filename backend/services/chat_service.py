from emergentintegrations.llm.chat import LlmChat, UserMessage
from typing import List, Dict, Optional, Tuple
import logging
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class ChatService:
    """Service for handling AI chat with multiple providers"""

    def __init__(self):
        self.api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not self.api_key:
            raise Exception("EMERGENT_LLM_KEY not found in environment variables")

    async def generate_response(
        self,
        message: str,
        session_id: str,
        system_message: str,
        model: str = "gpt-4o-mini",
        provider: str = "openai",
        context: Optional[str] = None,
        citation_footer: Optional[str] = None
    ) -> Tuple[str, Optional[str]]:
        """
        Generate AI response using specified model and provider

        Args:
            message: User message
            session_id: Session identifier for conversation continuity
            system_message: System instructions for the AI
            model: Model name
            provider: Provider name
            context: Additional context from RAG (pre-formatted with citations)
            citation_footer: Citation footer to append to response

        Returns:
            Tuple of (AI response, citation_footer)
        """
        try:
            # Enhance system message with RAG context if available
            enhanced_system = system_message
            if context:
                enhanced_system += f"\n\nRelevant Knowledge Base Context:\n{context}"
                enhanced_system += "\n\nImportant: Use the provided context to answer the question accurately and naturally. Integrate the information seamlessly without explicitly mentioning sources or reference numbers."

            # Initialize chat
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=enhanced_system
            )

            # Map provider names to the exact provider strings expected by the Emergent LLM integration
            provider_mapping = {
                "google": "google",
                "openai": "openai",
                "anthropic": "anthropic",
                "meta": "meta",
                "mistral": "mistral",
                "perplexity": "perplexity"
            }
            actual_provider = provider_mapping.get(provider, provider)

            # Set model and provider
            chat.with_model(actual_provider, model)

            # Create user message
            user_message = UserMessage(text=message)

            # Get response
            response = await chat.send_message(user_message)

            # Return response with citations if available
            return (response, citation_footer)

        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise Exception(f"Failed to generate response: {str(e)}")

    @staticmethod
    def get_available_models() -> Dict[str, List[str]]:
        """Get list of available models by provider"""
        return {
            "openai": [
                "gpt-6-astra",
                "gpt-5.6-sol",
                "gpt-5.6-luna",
                "gpt-5.4",
                "gpt-5.2",
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4",
                "o1",
                "o3",
                "o3-mini",
                "o4-mini",
            ],
            "anthropic": [
                "claude-opus-4-7",
                "claude-opus-4-6",
                "claude-sonnet-4-6",
                "claude-sonnet-4-5",
                "claude-3-5-sonnet-20241022",
                "claude-3-7-sonnet-20250219",
                "claude-haiku-4-5",
                "claude-3-5-haiku-20241022",
            ],
            "google": [
                "gemini/gemini-3.7-flash",
                "gemini/gemini-3.1-pro-preview",
                "gemini/gemini-3-flash-preview",
                "gemini/gemini-3.5-flash",
                "gemini/gemini-2.5-pro",
                "gemini/gemini-2.5-flash",
                "gemini/gemini-1.5-pro",
                "gemini/gemini-1.5-flash",
                "gemini/gemini-pro",
            ],
        }

    @staticmethod
    def get_provider_for_model(model: str) -> str:
        """Get provider name for a given model"""
        models = ChatService.get_available_models()
        for provider, provider_models in models.items():
            if model in provider_models:
                return provider
        return "openai"  # Default to OpenAI

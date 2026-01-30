# This is the fixed version of sync_subscription function
# Replace lines 451-502 in razorpay.py with this

@router.post("/subscription/sync")
async def sync_subscription(current_user: User = Depends(get_current_user)):
    """
    Sync user's subscription status from Razorpay and activate the plan.
    
    Checks if user has any active/paid subscriptions in Razorpay and:
    1. Updates local razorpay_subscriptions collection
    2. Processes payment through SubscriptionService to activate plan
    3. Updates user's plan in subscriptions collection
    
    This ensures the purchased plan is reflected on the dashboard.
    """
    try:
        # Find user's latest subscription in database
        subscription = await _db.razorpay_subscriptions.find_one(
            {"user_id": current_user.id},
            sort=[("created_at", -1)]
        )
        
        if not subscription:
            return {
                "success": True,
                "message": "No subscription found to sync",
                "synced": False
            }
        
        # Fetch latest status from Razorpay
        service = RazorpayService()
        razorpay_subscription = await service.get_subscription(subscription['subscription_id'])
        
        # Update local database with latest status
        await _db.razorpay_subscriptions.update_one(
            {"subscription_id": subscription['subscription_id']},
            {
                "$set": {
                    "status": razorpay_subscription.get("status"),
                    "razorpay_data": razorpay_subscription
                }
            }
        )
        
        # If subscription is active/authenticated, process the payment to activate the plan
        subscription_status = razorpay_subscription.get("status")
        if subscription_status in ['active', 'authenticated']:
            # Get payment details - Razorpay subscriptions have payments array
            plan_id = subscription.get('plan_id')
            user_id = current_user.id
            
            logger.info(f"[SYNC] Processing active subscription {subscription['subscription_id']} for user {user_id}, plan {plan_id}")
            
            # Generate a unique payment ID for this sync operation
            sync_payment_id = f"sync_{subscription['subscription_id']}_{user_id}"
            
            # Process through SubscriptionService to activate the plan
            result = await _subscription_service.process_payment_idempotent(
                payment_id=sync_payment_id,
                user_id=user_id,
                plan_id=plan_id,
                payment_source="manual_sync"
            )
            
            if result.get('status') == 'already_processed':
                logger.info(f"[SYNC] Subscription already processed for user {user_id}")
            else:
                logger.info(f"[SYNC] Successfully activated {plan_id} plan for user {user_id}")
            
            return {
                "success": True,
                "message": f"Subscription synced and {plan_id} plan activated successfully",
                "synced": True,
                "status": subscription_status,
                "plan_id": plan_id,
                "action": result.get('action_type'),
                "expires_at": str(result.get('subscription', {}).get('expires_at'))
            }
        
        # If subscription is not active, just return status
        return {
            "success": True,
            "message": f"Subscription synced (status: {subscription_status})",
            "synced": True,
            "status": subscription_status
        }
    
    except Exception as e:
        logger.error(f"Error syncing subscription: {str(e)}", exc_info=True)
        # Don't raise error, just return unsuccessful sync
        return {
            "success": False,
            "message": f"Failed to sync subscription: {str(e)}",
            "synced": False
        }

#!/usr/bin/env python3
"""
Analyze all message entry points to identify inconsistent usage tracking
"""

import re
import os
from pathlib import Path

def analyze_file(filepath):
    """Analyze a Python file for message handling and usage increment patterns"""
    with open(filepath, 'r') as f:
        content = f.content()
    
    results = {
        'file': filepath,
        'has_message_save': False,
        'has_usage_increment': False,
        'usage_service_type': None,
        'endpoints': []
    }
    
    # Check for message saving
    if 'db_instance.messages.insert' in content or '.messages.insert' in content:
        results['has_message_save'] = True
    
    # Check for usage increment patterns
    if 'UsageService' in content and 'increment_usage' in content:
        results['has_usage_increment'] = True
        results['usage_service_type'] = 'UsageService (NEW)'
    elif 'plan_service.increment_usage' in content:
        results['has_usage_increment'] = True
        results['usage_service_type'] = 'plan_service (OLD)'
    
    # Find endpoint definitions
    endpoint_pattern = r'@router\.(post|get|put|delete)\(["\']([^"\']+)'
    endpoints = re.findall(endpoint_pattern, content)
    results['endpoints'] = [f"{method.upper()} {path}" for method, path in endpoints]
    
    return results

def main():
    # Files to analyze
    files_to_check = [
        '/app/backend/routers/chat.py',          # Dashboard chat
        '/app/backend/routers/public_chat.py',   # Widget/embed chat
        '/app/backend/routers/discord.py',       # Discord integration
        '/app/backend/routers/telegram.py',      # Telegram integration
        '/app/backend/routers/whatsapp.py',      # WhatsApp integration
    ]
    
    print("=" * 80)
    print("MESSAGE TRACKING ANALYSIS")
    print("=" * 80)
    print()
    
    for filepath in files_to_check:
        if not os.path.exists(filepath):
            print(f"⚠️  {filepath} - NOT FOUND")
            continue
            
        result = analyze_file(filepath)
        
        print(f"📄 {os.path.basename(filepath)}")
        print(f"   Path: {filepath}")
        print(f"   Endpoints: {len(result['endpoints'])}")
        for endpoint in result['endpoints']:
            print(f"      - {endpoint}")
        print(f"   ✅ Saves messages: {result['has_message_save']}")
        print(f"   {'✅' if result['has_usage_increment'] else '❌'} Increments usage: {result['has_usage_increment']}")
        if result['usage_service_type']:
            print(f"   🔧 Service type: {result['usage_service_type']}")
        
        # Highlight problem
        if result['has_message_save'] and not result['has_usage_increment']:
            print(f"   🚨 PROBLEM: Saves messages but does NOT increment usage counter!")
        
        print()
    
    print("=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    print("1. All message entry points MUST use UsageService.increment_usage()")
    print("2. Replace plan_service.increment_usage() with UsageService.increment_usage()")
    print("3. Ensure atomic check + increment (no separate check_limit() calls)")
    print("4. Analytics should query subscriptions.usage, not messages collection")
    print()

if __name__ == "__main__":
    main()

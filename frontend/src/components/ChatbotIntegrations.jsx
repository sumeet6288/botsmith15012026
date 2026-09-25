import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '../hooks/use-toast';
import api from '../utils/api';
import { 
  MessageCircle, 
  Send, 
  CheckCircle, 
  Copy, 
  ExternalLink,
  AlertCircle,
  Zap,
  Globe,
  Phone,
  Settings,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Switch } from './ui/switch';

const ChatbotIntegrations = ({ chatbot }) => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIntegration, setActiveIntegration] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [credentials, setCredentials] = useState({});
  const [showCredentials, setShowCredentials] = useState({});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const integrationDefinitions = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Connect your agent to WhatsApp Business API',
      icon: <Phone className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'access_token', label: 'Access Token (from Meta Business Suite)', type: 'password', required: true },
        { name: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true },
        { name: 'verify_token', label: 'Verify Token (for webhook)', type: 'text', required: false, placeholder: 'botsmith_verify_token' }
      ]
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Deploy agent to your Slack workspace',
      icon: <Send className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'bot_token', label: 'Bot Token', type: 'password', required: true },
        { name: 'workspace_url', label: 'Workspace URL', type: 'text', required: false },
        { name: 'signing_secret', label: 'Signing Secret', type: 'password', required: false }
      ]
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Create a Telegram bot for your agent',
      icon: <Send className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'bot_token', label: 'Bot Token', type: 'password', required: true },
        { name: 'username', label: 'Bot Username', type: 'text', required: false }
      ]
    },
    {
      id: 'discord',
      name: 'Discord',
      description: 'Add agent to your Discord server',
      icon: <MessageCircle className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'bot_token', label: 'Bot Token', type: 'password', required: true },
        { name: 'client_id', label: 'Client ID', type: 'text', required: false },
        { name: 'server_id', label: 'Server ID', type: 'text', required: false }
      ]
    },
    {
      id: 'msteams',
      name: 'Microsoft Teams',
      description: 'Deploy agent to Microsoft Teams',
      icon: <MessageCircle className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'app_id', label: 'Bot App ID', type: 'text', required: true },
        { name: 'app_password', label: 'App Password', type: 'password', required: true },
        { name: 'tenant_id', label: 'Tenant ID', type: 'text', required: false }
      ]
    },
    {
      id: 'api',
      name: 'REST API',
      description: 'Integrate via REST API for custom applications',
      icon: <Zap className="w-6 h-6" />,
      accent: 'purple',
      fields: [],
      isAPIIntegration: true
    },
    {
      id: 'messenger',
      name: 'Facebook Messenger',
      description: 'Connect to Facebook Messenger',
      icon: <MessageCircle className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'page_access_token', label: 'Page Access Token', type: 'password', required: true },
        { name: 'app_secret', label: 'App Secret', type: 'password', required: false },
        { name: 'verify_token', label: 'Verify Token', type: 'text', required: false }
      ]
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Connect your agent to Instagram Direct Messages',
      icon: <MessageCircle className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'page_access_token', label: 'Page Access Token', type: 'password', required: true },
        { name: 'verify_token', label: 'Verify Token', type: 'text', required: false },
        { name: 'app_secret', label: 'App Secret', type: 'password', required: false }
      ]
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect your agent to Zapier for workflow automation',
      icon: <Zap className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'webhook_url', label: 'Webhook URL (from Zapier)', type: 'text', required: true },
        { name: 'api_key', label: 'API Key (optional)', type: 'password', required: false }
      ]
    },
    {
      id: 'twilio',
      name: 'Twilio SMS',
      description: 'Connect your agent to SMS via Twilio',
      icon: <Phone className="w-6 h-6" />,
      accent: 'purple',
      fields: [
        { name: 'account_sid', label: 'Account SID', type: 'text', required: true },
        { name: 'auth_token', label: 'Auth Token', type: 'password', required: true },
        { name: 'phone_number', label: 'Twilio Phone Number (E.164, e.g. +14155552671)', type: 'text', required: true, placeholder: '+14155552671' }
      ]
    }
  ];

  useEffect(() => {
    fetchIntegrations();
  }, [chatbot.id]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/integrations/${chatbot.id}`);
      setIntegrations(response.data);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integrations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await api.get(`/integrations/${chatbot.id}/logs`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const getIntegrationStatus = (integrationType) => {
    const integration = integrations.find(i => i.integration_type === integrationType);
    if (!integration) return null;
    return integration;
  };

  const openSetupModal = (definition) => {
    const existingIntegration = getIntegrationStatus(definition.id);
    setActiveIntegration(definition);
    setCredentials({});
    setShowCredentials({});
    setShowSetupModal(true);
  };

  const handleSaveIntegration = async () => {
    if (!activeIntegration) return;

    // Validate required fields
    const requiredFields = activeIntegration.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !credentials[f.name]);
    
    if (missingFields.length > 0) {
      toast({
        title: 'Missing Fields',
        description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);
      await api.post(`/integrations/${chatbot.id}`, {
        integration_type: activeIntegration.id,
        credentials: credentials,
        metadata: {}
      });

      toast({
        title: 'Success',
        description: `${activeIntegration.name} integration saved successfully`
      });

      setShowSetupModal(false);
      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to save integration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleIntegration = async (integrationId, currentStatus) => {
    try {
      await api.post(`/integrations/${chatbot.id}/${integrationId}/toggle`);
      
      toast({
        title: 'Success',
        description: `Integration ${currentStatus ? 'disabled' : 'enabled'}`
      });

      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle integration',
        variant: 'destructive'
      });
    }
  };

  const handleTestConnection = async (integrationId) => {
    try {
      setTesting(true);
      const response = await api.post(`/integrations/${chatbot.id}/${integrationId}/test`);
      
      if (response.data.success) {
        toast({
          title: 'Connection Successful',
          description: response.data.message
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: response.data.message,
          variant: 'destructive'
        });
      }

      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: error.response?.data?.detail || 'Failed to test connection',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetupTelegramWebhook = async (integrationId) => {
    try {
      setTesting(true);
      const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const response = await api.post(`/telegram/${chatbot.id}/setup-webhook`, {
        base_url: baseUrl
      });
      
      if (response.data.success) {
        toast({
          title: 'Webhook Configured',
          description: 'Telegram webhook has been set up successfully. Your bot is ready to receive messages!'
        });
        fetchIntegrations();
      }
    } catch (error) {
      toast({
        title: 'Webhook Setup Failed',
        description: error.response?.data?.detail || 'Failed to setup webhook',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetupSlackWebhook = async (integrationId) => {
    try {
      setTesting(true);
      const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const response = await api.post(`/slack/${chatbot.id}/setup-webhook`, {
        base_url: baseUrl
      });
      
      if (response.data.success) {
        // Show instructions in a modal or alert
        const instructions = response.data.instructions || [];
        const instructionsText = instructions.join('\n');
        
        toast({
          title: 'Webhook URL Generated',
          description: `Webhook URL: ${response.data.webhook_url}\n\nPlease complete setup in Slack App settings. Check console for detailed instructions.`
        });
        
        // Log instructions to console for easy access
        console.log('=== Slack Webhook Setup Instructions ===');
        console.log(`Webhook URL: ${response.data.webhook_url}`);
        console.log('\nSteps to complete:');
        instructions.forEach((instruction, index) => {
          console.log(instruction);
        });
        console.log('========================================');
        
        fetchIntegrations();
      }
    } catch (error) {
      toast({
        title: 'Webhook Setup Failed',
        description: error.response?.data?.detail || 'Failed to setup webhook',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetupInstagramWebhook = async (integrationId) => {
    try {
      setTesting(true);
      const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const response = await api.post(`/instagram/${chatbot.id}/setup-webhook`, {
        base_url: baseUrl
      });
      
      // Show instructions
      const instructions = response.data.instructions || [];
      
      toast({
        title: 'Webhook URL Generated',
        description: `Webhook URL: ${response.data.webhook_url}\nVerify Token: ${response.data.verify_token}\n\nCheck console for detailed instructions.`
      });
      
      // Log instructions to console for easy access
      console.log('=== Instagram Webhook Setup Instructions ===');
      console.log(`Webhook URL: ${response.data.webhook_url}`);
      console.log(`Verify Token: ${response.data.verify_token}`);
      console.log('\nSteps to complete:');
      instructions.forEach((instruction) => {
        console.log(instruction);
      });
      console.log('===========================================');
      
      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Webhook Setup Failed',
        description: error.response?.data?.detail || 'Failed to setup webhook',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetupWhatsAppWebhook = async (integrationId) => {
    try {
      setTesting(true);
      const response = await api.post(`/whatsapp/${chatbot.id}/setup-webhook`);
      
      // Show instructions
      const instructions = response.data.instructions || [];
      
      toast({
        title: 'WhatsApp Webhook URL Generated',
        description: `Webhook URL: ${response.data.webhook_url}\nVerify Token: ${response.data.verify_token}\n\nCheck console for detailed instructions.`
      });
      
      // Log instructions to console for easy access
      console.log('=== WhatsApp Webhook Setup Instructions ===');
      console.log(`Webhook URL: ${response.data.webhook_url}`);
      console.log(`Verify Token: ${response.data.verify_token}`);
      console.log('\nSteps to complete:');
      instructions.forEach((instruction) => {
        console.log(instruction);
      });
      console.log('===========================================');
      
      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Webhook Setup Failed',
        description: error.response?.data?.detail || 'Failed to setup WhatsApp webhook',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetupMessengerWebhook = async (integrationId) => {
    try {
      setTesting(true);
      const response = await api.post(`/messenger/${chatbot.id}/setup-webhook`);
      
      // Show instructions
      const instructions = response.data.instructions || [];
      
      toast({
        title: 'Messenger Webhook URL Generated',
        description: `Webhook URL: ${response.data.webhook_url}\nVerify Token: ${response.data.verify_token}\n\nCheck console for detailed instructions.`
      });
      
      // Log instructions to console for easy access
      console.log('=== Facebook Messenger Webhook Setup Instructions ===');
      console.log(`Webhook URL: ${response.data.webhook_url}`);
      console.log(`Verify Token: ${response.data.verify_token}`);
      console.log('\nSteps to complete:');
      instructions.forEach((instruction) => {
        console.log(instruction);
      });
      console.log('=======================================================');
      
      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Webhook Setup Failed',
        description: error.response?.data?.detail || 'Failed to setup Messenger webhook',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSetupTwilioWebhook = async (integrationId) => {
    try {
      setTesting(true);
      const baseUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
      const response = await api.post(`/twilio/${chatbot.id}/setup-webhook`, {
        base_url: baseUrl
      });

      const instructions = response.data.instructions || [];
      toast({
        title: 'Twilio Webhook URL Generated',
        description: `Webhook URL: ${response.data.webhook_url}\n\nCheck console for detailed setup steps.`
      });

      console.log('=== Twilio SMS Webhook Setup Instructions ===');
      console.log(`Webhook URL: ${response.data.webhook_url}`);
      instructions.forEach((instruction) => console.log(instruction));
      console.log('=============================================');

      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Webhook Setup Failed',
        description: error.response?.data?.detail || 'Failed to setup Twilio webhook',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleStartDiscordBot = async (integrationId) => {
    try {
      setTesting(true);
      const response = await api.post(`/discord/${chatbot.id}/start-bot`);
      
      if (response.data.success) {
        toast({
          title: 'Discord Bot Started',
          description: 'Your Discord bot is now online and listening for messages!',
        });
        
        fetchIntegrations();
      }
    } catch (error) {
      toast({
        title: 'Failed to Start Bot',
        description: error.response?.data?.detail || 'Failed to start Discord bot',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleStopDiscordBot = async (integrationId) => {
    try {
      setTesting(true);
      const response = await api.post(`/discord/${chatbot.id}/stop-bot`);
      
      if (response.data.success) {
        toast({
          title: 'Discord Bot Stopped',
          description: 'Your Discord bot has been stopped.',
        });
        
        fetchIntegrations();
      }
    } catch (error) {
      toast({
        title: 'Failed to Stop Bot',
        description: error.response?.data?.detail || 'Failed to stop Discord bot',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };


  const handleDeleteIntegration = async (integrationId, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name} integration?`)) {
      return;
    }

    try {
      await api.delete(`/integrations/${chatbot.id}/${integrationId}`);
      
      toast({
        title: 'Success',
        description: `${name} integration deleted`
      });

      fetchIntegrations();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete integration',
        variant: 'destructive'
      });
    }
  };

  const copyWebhookURL = async () => {
    const webhookURL = `${window.location.origin}/api/webhook/${chatbot.id}`;
    try {
      await navigator.clipboard.writeText(webhookURL);
      toast({
        title: 'Copied!',
        description: 'Webhook URL copied to clipboard'
      });
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = webhookURL;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard' });
      } catch (execErr) {
        toast({ title: 'Copy Failed', description: 'Could not copy to clipboard', variant: 'destructive' });
      }
      document.body.removeChild(textarea);
    }
  };

  const copyAPIKey = async () => {
    try {
      await navigator.clipboard.writeText(chatbot.id);
      toast({
        title: 'Copied!',
        description: 'Chatbot ID copied to clipboard'
      });
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = chatbot.id;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        toast({ title: 'Copied!', description: 'Chatbot ID copied to clipboard' });
      } catch (execErr) {
        toast({ title: 'Copy Failed', description: 'Could not copy to clipboard', variant: 'destructive' });
      }
      document.body.removeChild(textarea);
    }
  };

  const getStatusBadge = (status, enabled) => {
    if (!enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500">
          Disabled
        </span>
      );
    }

    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
            <XCircle className="h-3 w-3" />
            Error
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
            Pending Test
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
            Available
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="h-2.5 w-28 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-72 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="hidden h-9 w-36 animate-pulse rounded-lg bg-gray-100 sm:block" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-52 animate-pulse rounded-xl border border-gray-200 bg-white p-6">
              <div className="h-10 w-10 rounded-lg bg-gray-100" />
              <div className="mt-5 h-4 w-32 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-64 rounded bg-gray-100" />
              <div className="mt-8 h-9 w-full rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-[#F8F9FB] text-gray-950">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-purple-600">
            Workspace Channels
          </p>
          <h2 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-gray-950">
            Platform Channels
          </h2>
          <p className="mt-1.5 text-xs text-gray-500">
            Connect your agent to platforms and channels.
          </p>
        </div>

        <Button
          onClick={() => {
            setShowLogsModal(true);
            fetchLogs();
          }}
          variant="outline"
          className="h-9 border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-none hover:bg-gray-50 hover:text-gray-950"
        >
          <Activity className="mr-2 h-4 w-4" strokeWidth={1.8} />
          View Activity Logs
        </Button>
      </div>

      {/* Credentials / API information */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-none sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50">
            <Zap className="h-4 w-4 text-purple-600" strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-gray-950">
              Integration Credentials
            </h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Use these credentials to connect your agent to external platforms.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.1em] text-gray-500">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <Input
                value={`${window.location.origin}/api/webhook/${chatbot.id}`}
                readOnly
                className="h-9 border-gray-200 bg-gray-50 font-mono text-xs shadow-none"
              />
              <Button
                onClick={copyWebhookURL}
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 border-gray-200 bg-white p-0 text-gray-500 shadow-none hover:bg-gray-50 hover:text-gray-900"
              >
                <Copy className="h-4 w-4" strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.1em] text-gray-500">
              Chatbot ID
            </label>
            <div className="flex gap-2">
              <Input
                value={chatbot.id}
                readOnly
                className="h-9 border-gray-200 bg-gray-50 font-mono text-xs shadow-none"
              />
              <Button
                onClick={copyAPIKey}
                variant="outline"
                size="sm"
                className="h-9 w-9 shrink-0 border-gray-200 bg-white p-0 text-gray-500 shadow-none hover:bg-gray-50 hover:text-gray-900"
              >
                <Copy className="h-4 w-4" strokeWidth={1.8} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">
              Available Platforms
            </p>
            <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-gray-950">
              Channels & Integrations
            </h3>
          </div>
          <span className="text-xs text-gray-500">
            {integrations.length} configured
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {integrationDefinitions.map((definition) => {
            const integration = getIntegrationStatus(definition.id);
            const isConfigured = !!integration;
            const isConnected = integration?.enabled && integration?.status === 'connected';

            return (
              <Card
                key={definition.id}
                className={`rounded-xl border bg-white p-5 shadow-none transition-colors ${
                  isConnected
                    ? 'border-purple-200'
                    : isConfigured
                    ? 'border-gray-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
                      {React.cloneElement(definition.icon, {
                        className: 'h-4.5 w-4.5',
                        strokeWidth: 1.8,
                      })}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold tracking-tight text-gray-950">
                          {definition.name}
                        </h3>
                        {isConfigured && getStatusBadge(integration.status, integration.enabled)}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {definition.description}
                      </p>
                    </div>
                  </div>
                </div>

                {integration?.error_message && integration.enabled && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="flex items-start gap-2 text-xs leading-5 text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{integration.error_message}</span>
                    </p>
                  </div>
                )}

                {definition.id === 'discord' && isConfigured && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="flex items-start gap-2 text-xs leading-5 text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <strong>Important:</strong> Enable "MESSAGE CONTENT INTENT" in Discord Developer Portal → Your App → Bot → Privileged Gateway Intents. Then click the Start Bot button below.
                      </span>
                    </p>
                  </div>
                )}

                {isConfigured && (
                  <div className="mt-4 flex items-center justify-between border-y border-gray-100 py-3">
                    <div>
                      <p className="text-xs font-medium text-gray-800">Enable Integration</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        Control whether this channel is active.
                      </p>
                    </div>
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={() =>
                        handleToggleIntegration(integration.id, integration.enabled)
                      }
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => openSetupModal(definition)}
                    className="h-9 flex-1 bg-gray-950 px-3 text-xs font-medium text-white shadow-none hover:bg-gray-800"
                  >
                    <Settings className="mr-2 h-3.5 w-3.5" strokeWidth={1.8} />
                    {isConfigured ? 'Reconfigure' : 'Setup'}
                  </Button>

                  {isConfigured && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleTestConnection(integration.id)}
                        disabled={testing}
                        className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                        title="Test connection"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`}
                          strokeWidth={1.8}
                        />
                      </Button>

                      {definition.id === 'telegram' && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetupTelegramWebhook(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Setup Telegram Webhook"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      {definition.id === 'slack' && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetupSlackWebhook(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Setup Slack Webhook"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      {definition.id === 'discord' && (
                        <Button
                          variant="outline"
                          onClick={() => handleStartDiscordBot(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Start Discord Bot (Required for Messages)"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      {definition.id === 'instagram' && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetupInstagramWebhook(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Setup Instagram Webhook"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      {definition.id === 'whatsapp' && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetupWhatsAppWebhook(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Setup WhatsApp Webhook"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      {definition.id === 'messenger' && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetupMessengerWebhook(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Setup Messenger Webhook"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      {definition.id === 'twilio' && (
                        <Button
                          variant="outline"
                          onClick={() => handleSetupTwilioWebhook(integration.id)}
                          disabled={testing}
                          className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-600 shadow-none hover:bg-gray-50 hover:text-gray-950"
                          title="Setup Twilio SMS Webhook"
                        >
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => handleDeleteIntegration(integration.id, definition.name)}
                        className="h-9 w-9 border-gray-200 bg-white p-0 text-gray-500 shadow-none hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        title={`Delete ${definition.name} integration`}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Setup Modal */}
      <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
        <DialogContent
          className={`${
            activeIntegration?.isAPIIntegration ? 'max-w-3xl' : 'max-w-md'
          } max-h-[80vh] overflow-y-auto border-gray-200 bg-white`}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight text-gray-950">
              {activeIntegration?.isAPIIntegration
                ? `${activeIntegration?.name} Documentation`
                : `Setup ${activeIntegration?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs leading-5 text-gray-500">
              {activeIntegration?.isAPIIntegration
                ? 'Use these API endpoints to integrate your chatbot programmatically.'
                : `Enter your ${activeIntegration?.name} credentials to connect this integration.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {activeIntegration?.isAPIIntegration ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-600" strokeWidth={1.8} />
                    <h4 className="text-sm font-semibold text-gray-950">
                      REST API Integration
                    </h4>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-gray-500">
                    Use these endpoints to integrate your chatbot into custom applications via REST API.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Base URL</Label>
                  <div className="flex gap-2">
                    <Input
                      value={process.env.REACT_APP_BACKEND_URL || window.location.origin}
                      readOnly
                      className="h-9 border-gray-200 bg-gray-50 font-mono text-xs shadow-none"
                    />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          process.env.REACT_APP_BACKEND_URL || window.location.origin
                        );
                        toast({ title: 'Copied!', description: 'Base URL copied to clipboard' });
                      }}
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 shrink-0 border-gray-200 p-0 shadow-none"
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700">Chatbot ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={chatbot.id}
                      readOnly
                      className="h-9 border-gray-200 bg-gray-50 font-mono text-xs shadow-none"
                    />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(chatbot.id);
                        toast({ title: 'Copied!', description: 'Chatbot ID copied to clipboard' });
                      }}
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 shrink-0 border-gray-200 p-0 shadow-none"
                    >
                      <Copy className="h-4 w-4" strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-950">Available Endpoints</h4>

                  <div className="space-y-2.5">
                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-gray-950 px-2 py-1 text-[10px] font-bold font-mono text-white">
                          POST
                        </span>
                        <code className="text-xs font-mono text-gray-700">
                          /api/public/chat/{'{chatbot_id}'}
                        </code>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Send a message and get AI response
                      </p>
                      <div className="mt-2 rounded bg-gray-50 p-2 text-xs font-mono leading-5 text-gray-700">
                        <div className="text-gray-400">// Request Body</div>
                        <div>{`{`}</div>
                        <div className="pl-4">"message": "Your message here",</div>
                        <div className="pl-4">"session_id": "unique-session-id",</div>
                        <div className="pl-4">"user_name": "Optional User Name"</div>
                        <div>{`}`}</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold font-mono text-gray-700">
                          GET
                        </span>
                        <code className="text-xs font-mono text-gray-700">
                          /api/public/chatbot/{'{chatbot_id}'}
                        </code>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Get agent configuration and settings
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-950 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        Example cURL Request
                      </span>
                      <Button
                        onClick={() => {
                          const curlCommand = `curl -X POST "${process.env.REACT_APP_BACKEND_URL || window.location.origin}/api/public/chat/${chatbot.id}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello, how can you help me?",
    "session_id": "test-session-123",
    "user_name": "Test User"
  }'`;
                          navigator.clipboard.writeText(curlCommand);
                          toast({ title: 'Copied!', description: 'cURL command copied to clipboard' });
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-7 text-gray-300 hover:bg-gray-800 hover:text-white"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="mt-2 overflow-x-auto text-xs leading-5 text-gray-300">
{`curl -X POST "${process.env.REACT_APP_BACKEND_URL || window.location.origin}/api/public/chat/${chatbot.id}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Hello!",
    "session_id": "session-123"
  }'`}
                    </pre>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-900">Full API Documentation</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        For complete API documentation including all endpoints, authentication, and examples:
                      </p>
                      <Button
                        onClick={() =>
                          window.open(
                            `${process.env.REACT_APP_BACKEND_URL || window.location.origin}/docs`,
                            '_blank'
                          )
                        }
                        variant="outline"
                        size="sm"
                        className="mt-2 h-8 border-gray-200 bg-white text-xs shadow-none"
                      >
                        <ExternalLink className="mr-1.5 h-3 w-3" />
                        Open API Docs
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Webhook URL Field */}
                {activeIntegration?.id &&
                  ['whatsapp', 'slack', 'discord', 'msteams', 'messenger', 'instagram'].includes(
                    activeIntegration.id
                  ) && (
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-purple-600" strokeWidth={1.8} />
                        <Label className="text-xs font-semibold text-gray-900">
                          Webhook URL
                        </Label>
                      </div>
                      <p className="text-xs leading-5 text-gray-500">
                        Copy this URL and paste it in your {activeIntegration.name} dashboard webhook settings.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={`https://botsmith.pro/api/webhooks/${
                            activeIntegration.id === 'msteams'
                              ? 'teams'
                              : activeIntegration.id === 'messenger'
                              ? 'facebook'
                              : activeIntegration.id
                          }`}
                          readOnly
                          className="h-9 border-gray-200 bg-white font-mono text-xs shadow-none"
                        />
                        <Button
                          onClick={async () => {
                            const webhookUrl = `https://botsmith.pro/api/webhooks/${
                              activeIntegration.id === 'msteams'
                                ? 'teams'
                                : activeIntegration.id === 'messenger'
                                ? 'facebook'
                                : activeIntegration.id
                            }`;
                            try {
                              await navigator.clipboard.writeText(webhookUrl);
                              toast({
                                title: 'Webhook URL copied',
                                description: "Paste this URL in your platform's webhook settings",
                              });
                            } catch (err) {
                              console.error('Failed to copy:', err);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 shrink-0 border-gray-200 bg-white p-0 shadow-none"
                        >
                          <Copy className="h-4 w-4" strokeWidth={1.8} />
                        </Button>
                      </div>
                    </div>
                  )}

                {activeIntegration?.fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label
                      htmlFor={field.name}
                      className="text-xs font-medium text-gray-700"
                    >
                      {field.label}{' '}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        id={field.name}
                        type={showCredentials[field.name] ? 'text' : field.type}
                        value={credentials[field.name] || ''}
                        onChange={(e) =>
                          setCredentials({
                            ...credentials,
                            [field.name]: e.target.value,
                          })
                        }
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="h-9 border-gray-200 pr-10 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-purple-500"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowCredentials({
                              ...showCredentials,
                              [field.name]: !showCredentials[field.name],
                            })
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        >
                          {showCredentials[field.name] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {activeIntegration?.fields.length === 0 &&
                  !activeIntegration?.isAPIIntegration && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                      <p className="text-xs leading-5 text-gray-500">
                        This integration doesn't require any credentials. Click save to activate.
                      </p>
                    </div>
                  )}
              </>
            )}
          </div>

          <div className="flex gap-2 border-t border-gray-100 pt-4">
            {activeIntegration?.isAPIIntegration ? (
              <Button
                onClick={() => setShowSetupModal(false)}
                className="h-9 flex-1 bg-gray-950 text-xs font-medium text-white shadow-none hover:bg-gray-800"
              >
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowSetupModal(false)}
                  className="h-9 flex-1 border-gray-200 bg-white text-xs shadow-none"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveIntegration}
                  disabled={saving}
                  className="h-9 flex-1 bg-gray-950 text-xs font-medium text-white shadow-none hover:bg-gray-800"
                >
                  {saving ? 'Saving...' : 'Save Integration'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Logs Modal */}
      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-h-[80vh] max-w-2xl border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight text-gray-950">
              Integration Activity Logs
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Recent activity for all integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 space-y-2 overflow-y-auto py-4">
            {logs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
                <Activity className="mx-auto mb-3 h-5 w-5 text-gray-400" />
                <p className="text-xs text-gray-500">No activity logs yet</p>
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          log.status === 'success'
                            ? 'bg-emerald-500'
                            : log.status === 'failure'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-sm font-semibold capitalize text-gray-900">
                        {log.integration_type}
                      </span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs capitalize text-gray-500">
                        {log.event_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotIntegrations;

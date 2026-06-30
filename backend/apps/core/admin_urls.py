from django.urls import path
from .admin_views import (
    StatsView, AppSettingsView, AppSettingUpdateView, SmtpTestView,
    NewsletterListView, NewsletterSendView, NewsletterPreviewView,
    EmailTemplatesView, EmailTemplateUpdateView, AnalyticsView,
    TelegramSettingsView, TelegramTestView, TelegramWebhookSetupView,
    TelegramUploadSettingsView, TelegramUploadWebhookSetupView,
    BotsRestartView, VpnStatusView, WireGuardView,
    VpnConfigListView, VpnConfigDetailView, VpnConfigActivateView, VpnTestConfigsView,
    DockerContainersView, DockerContainerRestartView, DockerContainerLogsView,
    LLMStatusView, LLMTestView, LLMOllamaModelsView, LLMOllamaPullView, LLMBookAnalyzeView,
)

urlpatterns = [
    path('stats', StatsView.as_view()),
    path('analytics', AnalyticsView.as_view()),
    path('settings', AppSettingsView.as_view()),
    path('settings/<str:key>', AppSettingUpdateView.as_view()),
    path('smtp/test', SmtpTestView.as_view()),
    path('newsletters', NewsletterListView.as_view()),
    path('newsletters/<str:nl_id>/send', NewsletterSendView.as_view()),
    path('newsletters/preview', NewsletterPreviewView.as_view()),
    path('email-templates', EmailTemplatesView.as_view()),
    path('email-templates/<str:event>', EmailTemplateUpdateView.as_view()),
    path('telegram', TelegramSettingsView.as_view()),
    path('telegram/test', TelegramTestView.as_view()),
    path('telegram/webhook', TelegramWebhookSetupView.as_view()),
    path('telegram-upload', TelegramUploadSettingsView.as_view()),
    path('telegram-upload/webhook', TelegramUploadWebhookSetupView.as_view()),
    path('wireguard', WireGuardView.as_view()),
    path('vpn-status', VpnStatusView.as_view()),
    path('bots/restart', BotsRestartView.as_view()),
                      
    path('vpn/configs', VpnConfigListView.as_view()),
    path('vpn/configs/<str:config_id>', VpnConfigDetailView.as_view()),
    path('vpn/configs/<str:config_id>/activate', VpnConfigActivateView.as_view()),
    path('vpn/test-configs', VpnTestConfigsView.as_view()),
            
    path('docker/containers', DockerContainersView.as_view()),
    path('docker/containers/<str:container_name>/restart', DockerContainerRestartView.as_view()),
    path('docker/containers/<str:container_name>/logs', DockerContainerLogsView.as_view()),
                        
    path('llm/status', LLMStatusView.as_view()),
    path('llm/test', LLMTestView.as_view()),
    path('llm/ollama-models', LLMOllamaModelsView.as_view()),
    path('llm/ollama-pull', LLMOllamaPullView.as_view()),
    path('llm/analyze/<str:book_id>', LLMBookAnalyzeView.as_view()),
]

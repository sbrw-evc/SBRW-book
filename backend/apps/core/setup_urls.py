from django.urls import path
from .setup_views import SetupStatusView, SetupCompleteView, PublicSettingsView

urlpatterns = [
    path('status', SetupStatusView.as_view()),
    path('complete', SetupCompleteView.as_view()),
    path('public-settings', PublicSettingsView.as_view()),
]

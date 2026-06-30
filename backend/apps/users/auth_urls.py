from django.urls import path
from . import views

urlpatterns = [
    path('login', views.LoginView.as_view()),
    path('refresh', views.RefreshView.as_view()),
    path('me', views.MeView.as_view()),
    path('register', views.RegisterView.as_view()),
    path('verify-email', views.VerifyEmailView.as_view()),
    path('resend-verification', views.ResendVerificationView.as_view()),
    path('request-password-reset', views.RequestPasswordResetView.as_view()),
    path('reset-password', views.ResetPasswordView.as_view()),
         
    path('2fa/verify', views.Verify2FAView.as_view()),
    path('2fa/resend', views.Resend2FAView.as_view()),
          
    path('totp/setup', views.TOTPSetupView.as_view()),
    path('totp/enable', views.TOTPEnableView.as_view()),
    path('totp/disable', views.TOTPDisableView.as_view()),
                                
    path('telegram/webhook', views.TelegramWebhookView.as_view()),
]

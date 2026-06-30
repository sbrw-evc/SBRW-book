from django.urls import path
from . import views

urlpatterns = [
    path('', views.UserListView.as_view()),
    path('search', views.UserSearchView.as_view()),
    path('me', views.UpdateMeView.as_view()),
    path('me/library', views.MyLibraryView.as_view()),
    path('me/avatar', views.AvatarUploadView.as_view()),
    path('me/telegram', views.TelegramStatusView.as_view()),
    path('me/telegram/link', views.TelegramLinkInitView.as_view()),
    path('me/telegram/2fa', views.TelegramToggle2FAView.as_view()),
    path('me/sessions', views.SessionListView.as_view()),
    path('me/sessions/<str:session_id>', views.SessionRevokeView.as_view()),
    path('<str:user_id>/public', views.PublicProfileView.as_view()),
    path('<str:user_id>/role', views.UpdateUserRoleView.as_view()),
    path('<str:user_id>', views.UserDetailView.as_view()),
]

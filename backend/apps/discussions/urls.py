from django.urls import path
from . import views

urlpatterns = [
    path('<str:book_id>/discussions', views.DiscussionListView.as_view()),
    path('<str:book_id>/discussions/<str:discussion_id>', views.DiscussionDetailView.as_view()),
    path('<str:book_id>/reviews', views.ReviewListView.as_view()),
    path('<str:book_id>/reviews/<str:review_id>', views.ReviewDetailView.as_view()),
]

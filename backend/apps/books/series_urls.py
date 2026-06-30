from django.urls import path
from . import views

urlpatterns = [
    path('', views.SeriesListView.as_view()),
    path('<str:series_id>/books', views.SeriesBooksView.as_view()),
    path('<str:series_id>/subscription', views.SeriesSubscriptionView.as_view()),
    path('<str:series_id>', views.SeriesDetailView.as_view()),
]

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SeriesSubscription',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('series', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subscriptions', to='books.series')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='series_subscriptions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'series_subscriptions',
                'unique_together': {('user', 'series')},
            },
        ),
    ]

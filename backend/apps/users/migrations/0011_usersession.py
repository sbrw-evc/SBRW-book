import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0010_user_telegram_newsletter'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserSession',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('refresh_jti', models.CharField(db_index=True, max_length=36, unique=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True, default='')),
                ('device_os', models.CharField(blank=True, default='', max_length=150)),
                ('device_browser', models.CharField(blank=True, default='', max_length=150)),
                ('country', models.CharField(blank=True, default='', max_length=150)),
                ('city', models.CharField(blank=True, default='', max_length=150)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_seen_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sessions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'db_table': 'user_sessions', 'ordering': ['-created_at']},
        ),
    ]

import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Newsletter',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, primary_key=True, serialize=False)),
                ('subject', models.CharField(max_length=255)),
                ('body_html', models.TextField()),
                ('body_text', models.TextField(blank=True)),
                ('nl_type', models.CharField(
                    choices=[
                        ('new_book', 'Новая книга'),
                        ('update', 'Обновление приложения'),
                        ('custom', 'Произвольное'),
                    ],
                    default='custom',
                    max_length=50,
                )),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='newsletters',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('sent_count', models.IntegerField(default=0)),
            ],
            options={'db_table': 'newsletters', 'ordering': ['-created_at']},
        ),
    ]

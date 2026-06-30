import uuid
from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('username', models.CharField(max_length=50, unique=True)),
                ('email', models.EmailField(max_length=255, unique=True)),
                ('role', models.CharField(
                    choices=[('admin', 'admin'), ('moderator', 'moderator'), ('user', 'user')],
                    default='user',
                    max_length=20,
                )),
                ('locale', models.CharField(default='ru', max_length=10)),
                ('theme', models.CharField(default='light', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('avatar', models.CharField(blank=True, max_length=500, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'users',
            },
        ),
    ]

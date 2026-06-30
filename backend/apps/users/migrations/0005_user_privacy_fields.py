from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_reader_bg'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='show_full_name',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='show_reading_activity',
            field=models.BooleanField(default=False),
        ),
    ]

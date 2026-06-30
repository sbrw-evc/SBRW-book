from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_encrypt_user_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='telegram_newsletter_enabled',
            field=models.BooleanField(default=True),
        ),
    ]

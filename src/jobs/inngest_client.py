import inngest
from src.config import settings

# Initialize Inngest client 
# app_id groups all the functions together
inngest_client = inngest.Inngest(
    app_id=settings.inngest_app_id,
    is_production=settings.inngest_is_production,
)

import inngest

# Initialize Inngest client 
# app_id groups all the functions together
inngest_client = inngest.Inngest(
    app_id="financial-advisor-agent",
    is_production=False # set to True when launching to production 
)


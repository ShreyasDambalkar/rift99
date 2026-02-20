from pyngrok import ngrok
import time
import sys

# If the user has an authtoken, they can set it here
# ngrok.set_auth_token("YOUR_AUTH_TOKEN")

try:
    # Open a HTTP tunnel on port 8000
    public_url = ngrok.connect(8000).public_url
    print(f"\n\n🚀 PUBLIC URL: {public_url}\n\n")
    
    # Keep the script running
    while True:
        time.sleep(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

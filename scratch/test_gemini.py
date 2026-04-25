import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = "AIzaSyDjjY1CQsYS3Du46xeA0X_pm0_Q-BeR_pQ"
print(f"Using key: {api_key[:10]}...")

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

try:
    response = model.generate_content("test")
    print("Success!")
    print(response.text)
except Exception as e:
    print(f"Failed: {e}")

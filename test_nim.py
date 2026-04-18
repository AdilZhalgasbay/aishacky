import os
import requests
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("DEEPSEEK_API_KEY")
res = requests.post(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    headers={'Authorization': f'Bearer {key}'},
    json={'model': 'deepseek-ai/deepseek-r1', 'messages': [{'role': 'user', 'content': 'hi'}]}
)
print("r1", res.status_code, res.text)

res2 = requests.post(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    headers={'Authorization': f'Bearer {key}'},
    json={'model': 'meta/llama-3.1-70b-instruct', 'messages': [{'role': 'user', 'content': 'hi'}]}
)
print("llama", res2.status_code, res2.text)

res3 = requests.post(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    headers={'Authorization': f'Bearer {key}'},
    json={'model': 'deepseek-ai/deepseek-v3.2', 'messages': [{'role': 'user', 'content': 'hi'}]}
)
print("v3.2", res3.status_code, res3.text)

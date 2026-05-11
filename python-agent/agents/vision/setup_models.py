import os
import requests

MODELS = {
    "face_detection_yunet_2023mar.onnx": "https://github.com/opencv/opencv_zoo/raw/42f9b8705f15c13632f0590403109dcd486e/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx": "https://github.com/opencv/opencv_zoo/raw/42f9b8705f15c13632f0590403109dcd486e/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
}

target_dir = "d:/Antigravity Workspace/livekit-video-app/python-agent/agents/vision/models"
os.makedirs(target_dir, exist_ok=True)

print("--- V-ONE MODEL SETUP ---")
for name, url in MODELS.items():
    path = os.path.join(target_dir, name)
    if not os.path.exists(path):
        print(f"Downloading {name}...")
        r = requests.get(url, allow_redirects=True)
        with open(path, 'wb') as f:
            f.write(r.content)
        print(f"Downloaded {name} successfully.")
    else:
        print(f"{name} already exists.")

print("Setup complete.")

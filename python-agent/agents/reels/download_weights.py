import os
import urllib.request

def download_file(url, dest):
    print(f"Downloading {url} to {dest}...")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"Successfully downloaded to {dest}")

if __name__ == "__main__":
    base_dir = r"d:\Antigravity Workspace\livekit-video-app\python-agent\agents\reels\Wav2Lip"
    
    # Wav2Lip GAN weights
    wav2lip_url = "https://huggingface.co/camenduru/Wav2Lip/resolve/main/checkpoints/wav2lip_gan.pth"
    wav2lip_dest = os.path.join(base_dir, "checkpoints", "wav2lip_gan.pth")
    if not os.path.exists(wav2lip_dest):
        download_file(wav2lip_url, wav2lip_dest)
        
    # Face detection weights
    s3fd_url = "https://www.adrianbulat.com/downloads/python-fan/s3fd-619a316812.pth"
    s3fd_dest = os.path.join(base_dir, "face_detection", "detection", "sfd", "s3fd.pth")
    if not os.path.exists(s3fd_dest):
        download_file(s3fd_url, s3fd_dest)
        
    print("All weights downloaded successfully.")

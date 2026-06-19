import sys
import os
from ultralytics import YOLO
import cv2
import numpy as np

# Load model
model_path = os.path.join(os.path.dirname(__file__), "yolov8n.pt")

def solve_image(image_path):
    if not os.path.exists(model_path):
        print(f"ERROR: Model {model_path} not found")
        sys.exit(1)
        
    try:
        model = YOLO(model_path)
        results = model(image_path, verbose=False)
        
        human_detected = False
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                label = model.names[cls]
                if label == "person":
                    human_detected = True
                    break
        
        if human_detected:
            print("HUMAN_DETECTED=true", flush=True)
        else:
            print("HUMAN_DETECTED=false", flush=True)
            
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    solve_image(sys.argv[1])

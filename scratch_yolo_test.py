import os
import glob
from ultralytics import YOLO

model = YOLO('backend/yolov8n.pt')

list_of_files = glob.glob('backend/detections/*.jpg')
if not list_of_files:
    print("No images found.")
else:
    latest_file = max(list_of_files, key=os.path.getctime)
    print(f"Testing latest image: {latest_file}")
    
    results = model(latest_file, verbose=False, classes=[0])
    humans = []
    
    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            humans.append(conf)
            print(f"Human found with confidence: {conf}")
            
    if not humans:
        print("No humans found whatsoever! Even at 0.0 confidence?")

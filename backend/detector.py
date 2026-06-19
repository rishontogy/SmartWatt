import sys
print("Starting detector...", flush=True)

from flask import Flask, request, jsonify
from ultralytics import YOLO
import numpy as np
import cv2
import os

app  = Flask(__name__)
BASE = os.path.dirname(os.path.abspath(__file__))

print("[YOLO] Loading model...", flush=True)
model = YOLO(os.path.join(BASE, "yolov8n.pt"))
print("[YOLO] ✅ Model ready on port 5001", flush=True)

def preprocess(img):
    """Adjust brightness/contrast for VGA frames without introducing artifacts."""
    # Brightness +25, Contrast 1.2x — good balance for ESP32 shadows
    img = cv2.convertScaleAbs(img, alpha=1.2, beta=25)
    return img


def detect_humans(image_bytes):
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"human_detected": False, "error": "decode failed"}

        # ✅ Preprocess for better detection (Stronger contrast for low light)
        img = cv2.convertScaleAbs(img, alpha=1.3, beta=30)
        
        # ✅ Save debug image so you can see what YOLO sees
        debug_path = os.path.join(BASE, "debug_last.jpg")
        cv2.imwrite(debug_path, img)
        print(f"[YOLO] Debug image saved: {debug_path}", flush=True)

        # ✅ Process using YOLO's native mechanisms 
        results = model(
            img,
            verbose=False,
            classes=[0],       # only person class
            conf=0.15,         # ✅ Lowered threshold to avoid missing people (False Negatives)
            iou=0.45,
            imgsz=640          # ✅ force 640 input size
        )

        humans   = []
        max_conf = 0.0

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0])
                if int(box.cls[0]) == 0:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    humans.append({
                        "confidence": round(conf, 3),
                        "bbox": [x1, y1, x2, y2]
                    })
                    if conf > max_conf:
                        max_conf = conf

                    # ✅ Draw box on debug image
                    cv2.rectangle(img, (x1,y1), (x2,y2), (0,255,0), 2)
                    cv2.putText(img, f"person {conf:.2f}",
                                (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX,
                                0.5, (0,255,0), 1)

        # ✅ Save annotated debug image
        cv2.imwrite(os.path.join(BASE, "debug_annotated.jpg"), img)

        found = len(humans) > 0
        print(f"[YOLO] human={found}  count={len(humans)}  conf={round(max_conf,3)}", flush=True)

        return {
            "human_detected": found,
            "count":          len(humans),
            "confidence":     round(max_conf, 3),
            "detections":     humans
        }

    except Exception as e:
        print(f"[YOLO] Error: {e}", flush=True)
        return {"human_detected": False, "error": str(e)}


@app.route("/detect", methods=["POST"])
def detect():
    data = request.data
    if not data or len(data) < 100:
        return jsonify({"human_detected": False, "error": "no image"}), 400
    print(f"[YOLO] Received {len(data)} bytes", flush=True)
    return jsonify(detect_humans(data))


@app.route("/health")
def health():
    return jsonify({"status": "ok", "model": "yolov8n"})


if __name__ == "__main__":
    print("[YOLO] Flask starting on port 5001...", flush=True)
    app.run(host="0.0.0.0", port=5001, debug=False)
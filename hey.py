import cv2
import face_recognition
import RPi.GPIO as GPIO
import time
import pyttsx3
import os
import threading

# --- CONFIGURATION ---
# GPIO Pins (Use BCM numbering)
PIR_PIN = 17      # PIR Sensor OUT -> Pin 11
SERVO_PIN = 18    # Servo Signal -> Pin 12
LED_PIN = 22      # LED Long Leg -> Pin 15
BUZZER_PIN = 27   # Buzzer Positive -> Pin 13

# Door Settings
UNLOCK_TIME = 5   # How long the door stays unlocked (seconds)

# Servo Settings (Adjust these if your servo behaves oddly)
SERVO_LOCKED_ANGLE = 2.5   # Duty cycle for 0 degrees (Locked)
SERVO_UNLOCKED_ANGLE = 7.5 # Duty cycle for 90 degrees (Unlocked)

# --- SETUP ---
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

# Setup Sensors & Actuators
GPIO.setup(PIR_PIN, GPIO.IN)
GPIO.setup(LED_PIN, GPIO.OUT)
GPIO.setup(BUZZER_PIN, GPIO.OUT)
GPIO.setup(SERVO_PIN, GPIO.OUT)

# Initialize Servo
servo = GPIO.PWM(SERVO_PIN, 50) # 50Hz pulse
servo.start(0) # Start with 0 duty cycle (no movement)

# Initialize Text-to-Speech
engine = pyttsx3.init()
engine.setProperty('rate', 150) # Speed of speech
engine.setProperty('volume', 1.0)

# --- FUNCTIONS ---

def speak(text):
    """ Speaks the text in a separate thread so it doesn't block the camera """
    def _speak():
        engine.say(text)
        engine.runAndWait()
    threading.Thread(target=_speak).start()

def set_servo_angle(duty_cycle):
    """ Moves the servo to a specific angle """
    GPIO.output(SERVO_PIN, True)
    servo.ChangeDutyCycle(duty_cycle)
    time.sleep(0.5) # Give it time to move
    GPIO.output(SERVO_PIN, False)
    servo.ChangeDutyCycle(0) # Stop sending signal to prevent jitter

def unlock_door():
    """ Unlocks the door, waits, and locks it again """
    print("DOOR UNLOCKED")
    GPIO.output(LED_PIN, GPIO.HIGH) # Turn on Green LED (if using green)
    set_servo_angle(SERVO_UNLOCKED_ANGLE)
    
    time.sleep(UNLOCK_TIME)
    
    print("DOOR LOCKED")
    set_servo_angle(SERVO_LOCKED_ANGLE)
    GPIO.output(LED_PIN, GPIO.LOW) # Turn off LED

def deny_access():
    """ Triggers the alarm and LED for unknown faces """
    print("ACCESS DENIED")
    speak("Access Denied. Unknown person detected.")
    
    # Flash LED and beep Buzzer 3 times
    for _ in range(3):
        GPIO.output(BUZZER_PIN, GPIO.HIGH)
        GPIO.output(LED_PIN, GPIO.HIGH)
        time.sleep(0.2)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        GPIO.output(LED_PIN, GPIO.LOW)
        time.sleep(0.2)

def load_known_faces():
    """ Loads face images from the 'faces' folder and learns them """
    known_encodings = []
    known_names = []
    
    # Create 'faces' directory if it doesn't exist
    if not os.path.exists("faces"):
        os.makedirs("faces")
        print("Created 'faces' folder. Please add photos of allowed people there.")
        return [], []

    print("Loading known faces...")
    for filename in os.listdir("faces"):
        if filename.endswith(".jpg") or filename.endswith(".png"):
            name = os.path.splitext(filename)[0] # Use filename as the person's name
            image_path = os.path.join("faces", filename)
            
            try:
                image = face_recognition.load_image_file(image_path)
                encoding = face_recognition.face_encodings(image)[0]
                known_encodings.append(encoding)
                known_names.append(name)
                print(f"Loaded: {name}")
            except IndexError:
                print(f"Warning: No face found in {filename}")
                
    return known_encodings, known_names

# --- MAIN LOOP ---

def main():
    # 1. Load Known Faces
    known_face_encodings, known_face_names = load_known_faces()
    
    if not known_face_encodings:
        print("No known faces found! Please add images to the 'faces' folder.")
        # We continue anyway for testing purposes
    
    print("System Ready. Waiting for motion...")
    speak("System Online")

    # Initialize Camera
    video_capture = cv2.VideoCapture(0)
    # Reduce resolution for faster processing on Pi Zero
    video_capture.set(3, 320)
    video_capture.set(4, 240)

    try:
        while True:
            # 2. Check for Motion (PIR Sensor)
            if GPIO.input(PIR_PIN):
                print("Motion Detected! Scanning face...")
                
                # Read a single frame from the camera
                ret, frame = video_capture.read()
                
                if ret:
                    # Convert BGR (OpenCV) to RGB (face_recognition)
                    rgb_frame = frame[:, :, ::-1]
                    
                    # Find all faces in the current frame
                    face_locations = face_recognition.face_locations(rgb_frame)
                    face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

                    face_found = False
                    
                    for face_encoding in face_encodings:
                        face_found = True
                        # See if the face is a match for the known face(s)
                        matches = face_recognition.compare_faces(known_face_encodings, face_encoding, tolerance=0.5)
                        name = "Unknown"

                        # Use the known face with the smallest distance to the new face
                        face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
                        if len(face_distances) > 0:
                            best_match_index = list(face_distances).index(min(face_distances))
                            if matches[best_match_index]:
                                name = known_face_names[best_match_index]
                                
                                # --- AUTHORIZED ACCESS ---
                                print(f"Welcome, {name}!")
                                speak(f"Welcome home, {name}")
                                unlock_door()
                                break # Stop checking other faces if one authorized person is found
                        
                        # --- UNAUTHORIZED ACCESS ---
                        if name == "Unknown":
                            deny_access()

                    if not face_found:
                        print("Motion detected but no face seen.")
                
                # Wait a bit before scanning again to avoid spamming
                time.sleep(2)
            
            else:
                # No motion, sleep briefly to save CPU
                time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        video_capture.release()
        GPIO.cleanup()
        servo.stop()

if __name__ == "__main__":
    main()
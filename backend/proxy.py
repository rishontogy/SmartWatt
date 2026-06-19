import socket
import select
import sys
import threading

LOCAL_PORT = 3001
TARGET_HOST = "127.0.0.1"
TARGET_PORT = 3005

def handle_client(client_socket):
    try:
        remote_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        remote_socket.connect((TARGET_HOST, TARGET_PORT))
    except Exception as e:
        print(f"[PROXY] Failed to connect to local Node server on {TARGET_PORT}: {e}")
        client_socket.close()
        return

    print("[PROXY] Established bridge: ESP32 <--> Node.js Server")
    
    sockets = [client_socket, remote_socket]
    try:
        while True:
            readable, _, _ = select.select(sockets, [], [])
            for s in readable:
                if s is client_socket:
                    data = client_socket.recv(4096)
                    if not data:
                        return
                    remote_socket.sendall(data)
                elif s is remote_socket:
                    data = remote_socket.recv(4096)
                    if not data:
                        return
                    client_socket.sendall(data)
    except Exception as e:
        print(f"[PROXY] Connection dropped: {e}")
    finally:
        client_socket.close()
        remote_socket.close()

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Allow port reuse so it starts cleanly
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind(("0.0.0.0", LOCAL_PORT))
        server.listen(10)
        print(f"[PROXY] SUCCESS: Listening natively on 0.0.0.0:{LOCAL_PORT} to bypass node.exe firewall block.")
    except Exception as e:
        print(f"[PROXY] FATAL: Could not bind to port {LOCAL_PORT}: {e}")
        sys.exit(1)

    while True:
        try:
            client_socket, addr = server.accept()
            print(f"[PROXY] ✨ Incoming ESP32 Connection from {addr[0]}:{addr[1]}")
            client_thread = threading.Thread(target=handle_client, args=(client_socket,))
            client_thread.daemon = True
            client_thread.start()
        except KeyboardInterrupt:
            print("[PROXY] Shutting down.")
            sys.exit(0)

if __name__ == "__main__":
    main()

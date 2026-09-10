#!/usr/bin/env python3
"""Run a root rotation command in a real PTY with prompt-synchronized input."""

import os
import pty
import select
import sys
import termios
import fcntl
import time
import signal
import errno


PROMPT = b"PostgreSQL administrative password (input hidden): "
READY = b"P3_WP6_PROMPT_READY\n"


def child_status(status: int) -> int:
    if os.WIFEXITED(status):
        return os.WEXITSTATUS(status)
    if os.WIFSIGNALED(status):
        return 128 + os.WTERMSIG(status)
    return 1


def main() -> int:
    separator = next((index for index, value in enumerate(sys.argv) if value == "--"), -1)
    if separator < 0 or separator + 1 >= len(sys.argv):
        print("usage: p3-wp6-pty-runner.py -- <command> [args...]", file=sys.stderr)
        return 2

    command = sys.argv[separator + 1:]
    master_fd, slave_fd = pty.openpty()
    pid = os.fork()
    if pid == 0:
        try:
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if master_fd > 2:
                os.close(master_fd)
            if slave_fd > 2:
                os.close(slave_fd)
            child_env = os.environ.copy()
            child_env.pop("P3_DB_ADMIN_PASSWORD", None)
            os.execvpe(command[0], command, child_env)
        except BaseException as error:
            os.write(2, f"PTY child failed: {error}\n".encode())
            os._exit(127)

    # The parent must not keep the slave open.  Otherwise the master never
    # observes EOF when the child exits, and the orchestration loop can hang.
    try:
        os.close(slave_fd)
    except OSError as error:
        if error.errno != errno.EBADF:
            raise

    prompt_seen = False
    ready_notified = False
    password_sent = False
    stdin_buffer = b""
    output_tail = b""
    master_open = True
    stdin_open = True
    status = None
    synchronization_deadline = time.monotonic() + 30
    echo_disabled = False

    try:
        while master_open:
            if time.monotonic() >= synchronization_deadline and not password_sent:
                raise RuntimeError(
                    "PTY prompt synchronization timed out "
                    f"(prompt_seen={prompt_seen}, echo_disabled={echo_disabled})",
                )
            read_fds = [master_fd]
            if prompt_seen and not password_sent and stdin_open:
                read_fds.append(0)
            readable, _, _ = select.select(read_fds, [], [], 0.1)

            if master_fd in readable:
                try:
                    data = os.read(master_fd, 4096)
                except OSError:
                    data = b""
                if not data:
                    master_open = False
                else:
                    sys.stdout.buffer.write(data)
                    sys.stdout.buffer.flush()
                    output_tail = (output_tail + data)[-(len(PROMPT) + 128):]
                    if not prompt_seen and PROMPT in output_tail:
                        prompt_seen = True

            if prompt_seen and not password_sent:
                attributes = termios.tcgetattr(slave_fd)
                echo_disabled = not attributes[3] & termios.ECHO
                if echo_disabled:
                    if not ready_notified:
                        os.write(2, READY)
                        sys.stderr.flush()
                        ready_notified = True
                    if 0 not in readable:
                        continue

            if 0 in readable and prompt_seen and not password_sent:
                incoming = os.read(0, 4096)
                if not incoming:
                    stdin_open = False
                    raise RuntimeError("PTY password input closed before newline")
                stdin_buffer += incoming
                newline = stdin_buffer.find(b"\n")
                if newline >= 0:
                    os.write(master_fd, stdin_buffer[:newline + 1])
                    password_sent = True
                    stdin_open = False

            if status is None:
                try:
                    waited_pid, waited_status = os.waitpid(pid, os.WNOHANG)
                except ChildProcessError:
                    raise RuntimeError("PTY child was reaped without a status")
                if waited_pid == pid and waited_status is not None:
                    status = waited_status
                    if not master_open:
                        break

        if status is None:
            _, status = os.waitpid(pid, 0)
        if not password_sent and prompt_seen:
            return 97
        return child_status(status)
    except BaseException as error:
        print(f"PTY runner failed: {error}", file=sys.stderr)
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
        reap_deadline = time.monotonic() + 2
        while True:
            try:
                waited_pid, _ = os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                break
            if waited_pid == pid:
                break
            if time.monotonic() >= reap_deadline:
                try:
                    os.killpg(os.getpgid(pid), signal.SIGKILL)
                except (ProcessLookupError, PermissionError):
                    pass
                try:
                    os.waitpid(pid, 0)
                except ChildProcessError:
                    pass
                break
            time.sleep(0.05)
        return 98
    finally:
        os.close(master_fd)
        os.close(slave_fd)


if __name__ == "__main__":
    sys.exit(main())

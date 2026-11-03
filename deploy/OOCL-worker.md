# Local OOCL worker

The optional worker uses the existing OOCL provider on a Windows computer. Only OOCL requests are forwarded. The Windows process and the remote SSH listener must both be bound to loopback. No inbound port needs to be opened on Windows.

1. Deploy the worker-enabled revision to OceanScope using its normal release process. The feature remains off until explicitly enabled.
2. In Windows PowerShell in the project directory, generate a random token and copy it for the server. Keep this shell open while the worker runs.

   ```powershell
   $env:OOCL_WORKER_TOKEN = node -p "require('crypto').randomBytes(32).toString('hex')"
   Set-Clipboard -Value $env:OOCL_WORKER_TOKEN
   node scripts/oocl-worker.cjs
   ```

3. In another Windows terminal establish the tunnel. Replace PORT and HOST with the Ubuntu SSH connection settings. Verify the server host key on first connection. The server must permit remote port forwarding.

   ```text
   ssh -NT -p PORT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 127.0.0.1:18341:127.0.0.1:18341 ubuntu@HOST
   ```

4. On Ubuntu, confirm that `ss -ltn | grep 18341` shows only a loopback listener. As the oceanscope user, POST to `http://127.0.0.1:18341/query` without a token and expect HTTP 401. This verifies that the SSH tunnel reaches the worker before enabling it.
5. Use `sudoedit /etc/oceanscope/oceanscope.env` to set `OOCL_WORKER_TOKEN` to the copied token and `OOCL_USE_LOCAL_WORKER=true`. Keep the existing entries and file permissions. Clear the Windows clipboard after copying. Restart only oceanscope.service. Test an uncached Shanghai to Los Angeles search, including Long Beach.
6. Keep both terminals open and the computer awake during use. If the worker is offline, uncached OOCL searches fail. To revert, set `OOCL_USE_LOCAL_WORKER=false` and restart oceanscope.service. There are no schema changes.

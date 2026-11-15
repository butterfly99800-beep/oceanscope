for (const command of ['enable', 'disable']) document.getElementById(command).onclick = async () => {
  const result = await chrome.runtime.sendMessage({command});
  document.getElementById('status').textContent = result.status;
};

async function refreshStatus(){const result=await chrome.runtime.sendMessage({command:'status'});document.getElementById('status').textContent=result.status;}
refreshStatus();setInterval(refreshStatus,2000);

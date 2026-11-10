self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'Aula Budô',{
    body:data.body||'Hora de conferir a etapa da aula.',
    icon:'/budo-icon-192.jpg',badge:'/budo-icon-192.jpg',
    tag:data.tag||'budo-live',renotify:true,data:{url:data.url||'/'},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const open=windows.find(window=>window.url.startsWith(self.location.origin));
    return open?open.focus():clients.openWindow(url);
  }));
});

'use strict';
// Classic scripts work for both extracted local files and static HTTP hosting.
window.ArxivData=(()=>{
 const values=new Map(),pending=new Map();
 function register(key,value){values.set(key,value)}
 function load(key,base='data/'){
  if(!/^[A-Za-z0-9_-]+$/.test(key))return Promise.reject(new Error('Invalid data selection.'));
  if(values.has(key))return Promise.resolve(values.get(key));
  if(pending.has(key))return pending.get(key);
  const task=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=base+key+'.js';script.async=true;
   script.onload=()=>{script.remove();if(values.has(key))resolve(values.get(key));else reject(new Error('The selected data file is incomplete.'))};
   script.onerror=()=>{script.remove();reject(new Error('Could not open the selected data file. Extract the entire website folder and try again.'))};
   document.head.appendChild(script);
  });
  pending.set(key,task);task.catch(()=>pending.delete(key));return task;
 }
 return Object.freeze({register,load});
})();

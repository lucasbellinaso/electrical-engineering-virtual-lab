import {simulate} from './model.js';
self.addEventListener('message',event=>{
 const {id,parameters}=event.data;
 try{self.postMessage({id,result:simulate(parameters)});}catch(error){self.postMessage({id,error:error.code||'parameters'});}
});

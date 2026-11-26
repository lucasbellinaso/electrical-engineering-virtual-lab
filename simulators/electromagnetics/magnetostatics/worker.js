import {sampleMap} from './model.js';
self.addEventListener('message',event=>{const {id,parameters,options}=event.data;try{self.postMessage({id,result:sampleMap(parameters,options)});}catch(error){self.postMessage({id,error:error.message});}});

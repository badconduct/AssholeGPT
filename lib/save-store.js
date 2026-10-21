import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
export function saveStore(directory) {
  const writes=new Map();
  function codeOK(code) {if(!/^[a-f0-9]{36}$/.test(code))throw new Error('Enter a valid save code.');}
  return {
    async write(code,data) {
      codeOK(code);
      const json=JSON.stringify(data),previous=writes.get(code) || Promise.resolve();
      const job=previous.catch(()=>{}).then(async()=>{
        await mkdir(directory,{recursive:true});
        const target=join(directory,code+'.json'),temp=target+'.'+randomBytes(8).toString('hex')+'.tmp';
        try {await writeFile(temp,json,{flag:'wx'});await rename(temp,target);}
        finally {await unlink(temp).catch(()=>{});}
      });
      writes.set(code,job);
      try {await job;} finally {if(writes.get(code)===job)writes.delete(code);}
    },
    async read(code) {codeOK(code);await writes.get(code);try{return JSON.parse(await readFile(join(directory,code+'.json'),'utf8'));}catch{throw new Error('That save could not be found.');}}
  };
}

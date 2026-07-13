"use strict";(()=>{var c=(s,t)=>()=>{try{return t||s((t={exports:{}}).exports,t),t.exports}catch(a){throw t=0,a}};var d=c(()=>{var r=s=>s?s.replace(/[&<>'"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[t]||t):"";document.addEventListener("DOMContentLoaded",async()=>{let s=document.getElementById("historyList"),t=document.getElementById("clearBtn"),a=n=>({spellcheck:"\u041E\u0448\u0438\u0431\u043A\u0438",style:"\u0421\u0442\u0438\u043B\u044C",emoji:"\u042D\u043C\u043E\u0434\u0437\u0438",layout:"\u0420\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0430",translate:"\u041F\u0435\u0440\u0435\u0432\u043E\u0434"})[n]||n,o=async()=>{let i=(await chrome.storage.local.get({aiHistory:[]})).aiHistory;if(s){if(i.length===0){s.innerHTML='<div class="empty">\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0443\u0441\u0442\u0430. \u0412\u0430\u0448\u0438 \u0443\u0441\u043F\u0435\u0448\u043D\u044B\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C.</div>',t&&(t.style.display="none");return}t&&(t.style.display="block"),s.innerHTML=i.map(e=>`
            <div class="history-card">
                <div class="history-header">
                    <span class="mode-badge">${a(e.mode)}</span>
                    <span>${new Date(e.date).toLocaleString("ru-RU")}</span>
                </div>
                <div class="text-block">
                    <div class="label">\u041E\u0440\u0438\u0433\u0438\u043D\u0430\u043B</div>
                    <div class="content">${r(e.original)}</div>
                </div>
                <div class="text-block">
                    <div class="label">\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0418\u0418</div>
                    <div class="content result">${r(e.result)}</div>
                </div>
            </div>
        `).join("")}};t&&t.addEventListener("click",async()=>{confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0432\u0441\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432? \u042D\u0442\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C.")&&(await chrome.storage.local.set({aiHistory:[]}),o())}),o()})});d();})();

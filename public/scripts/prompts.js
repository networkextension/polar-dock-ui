import{a as p,c as P}from"./chunk-JKVQ6N26.js";import{a as f,b as g,d as $,f as v,g as b,h as M}from"./chunk-DKS6OQMY.js";import{n as x,o as y,q as E}from"./chunk-5DACRDVC.js";import{b as c,c as L}from"./chunk-QSYSDSOO.js";import{a,c as h}from"./chunk-BY6I6UVC.js";var q=h(()=>{P();L();$();E();M();var i=p("promptsList"),w=p("promptsStatus"),r=[];function m(t,e=!1){w.textContent=t,w.style.color=e?"#c33":"#3a7"}a(m,"setStatus");function n(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}a(n,"escapeHTML");async function H(){m("\u52A0\u8F7D\u4E2D...");let{response:t,data:e}=await c("/api/prompts");if(!t.ok){m("\u52A0\u8F7D\u5931\u8D25 \u2014 \u9700\u8981\u7BA1\u7406\u5458\u6743\u9650",!0);return}r=e.prompts??[],m(`${r.length} \u6761`),S()}a(H,"loadPrompts");function S(){if(r.length===0){i.innerHTML='<div style="color:var(--text-muted,#888); font-size:13px;">\u6682\u65E0\u6A21\u677F\uFF08\u5E94\u8BE5\u5728\u670D\u52A1\u542F\u52A8\u65F6\u81EA\u52A8 bootstrap\uFF0C\u68C0\u67E5 dock \u65E5\u5FD7\uFF09\u3002</div>';return}i.innerHTML=r.map(t=>{let e=t.content!==t.default_content,o=e?'<span style="color:#3a7; font-size:11px; padding:2px 6px; background:#e6f4ed; border-radius:3px;">\u5DF2\u7F16\u8F91</span>':'<span style="color:var(--text-muted,#888); font-size:11px;">\u9ED8\u8BA4</span>',s=t.updated_at?new Date(t.updated_at).toLocaleString():"";return`
        <div style="border:1px solid var(--border,#ececf0); border-radius:6px; padding:10px; background:var(--card,#fff);">
          <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; margin-bottom:6px;">
            <strong style="font-size:14px;">${n(t.name||t.slug)}</strong>
            <code style="font-size:11px; color:var(--text-muted,#888);">${n(t.slug)}</code>
            ${o}
            <span style="flex:1;"></span>
            <span class="text-meta-mono" style="font-size:11px; color:var(--text-muted,#888);">\u66F4\u65B0\u4E8E ${n(s)}</span>
          </div>
          ${t.description?`<div style="font-size:12px; color:var(--text-muted,#888); margin-bottom:8px; white-space:pre-wrap;">${n(t.description)}</div>`:""}
          <textarea
            data-slug="${n(t.slug)}"
            class="input textarea"
            rows="10"
            spellcheck="false"
            style="font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; width:100%; box-sizing:border-box;"
          >${n(t.content)}</textarea>
          <div style="display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;">
            <button class="btn-inline btn-secondary" type="button" data-save="${n(t.slug)}">\u4FDD\u5B58</button>
            <button class="btn-inline" type="button" data-reset="${n(t.slug)}" ${e?"":"disabled"}>\u91CD\u7F6E\u4E3A\u9ED8\u8BA4</button>
            <span data-row-status="${n(t.slug)}" class="status-text" style="font-size:11px;"></span>
          </div>
        </div>
      `}).join("")}a(S,"renderList");async function T(t,e){let o=i.querySelector(`[data-row-status="${CSS.escape(t)}"]`);o&&(o.textContent="\u4FDD\u5B58\u4E2D...");let{response:s,data:l}=await c(`/api/prompts/${encodeURIComponent(t)}`,{method:"PUT",body:{content:e}});if(!s.ok||!l.prompt){o&&(o.textContent="\u4FDD\u5B58\u5931\u8D25",o.style.color="#c33");return}r=r.map(u=>u.slug===t?l.prompt:u),S();let d=i.querySelector(`[data-row-status="${CSS.escape(t)}"]`);d&&(d.textContent="\u5DF2\u4FDD\u5B58",d.style.color="#3a7")}a(T,"savePrompt");function z(t){let e=r.find(o=>o.slug===t);e&&confirm(`\u91CD\u7F6E "${e.name||e.slug}" \u4E3A\u4EE3\u7801\u9ED8\u8BA4\uFF1F\u5F53\u524D\u7F16\u8F91\u7684\u5185\u5BB9\u4F1A\u4E22\u5931\u3002`)&&T(t,e.default_content)}a(z,"resetPrompt");i.addEventListener("click",t=>{let e=t.target,o=e.dataset.save;if(o){let l=i.querySelector(`textarea[data-slug="${CSS.escape(o)}"]`);l&&T(o,l.value);return}let s=e.dataset.reset;s&&z(s)});var k=p("logoutBtn");k.addEventListener("click",()=>{g().then(()=>{window.location.href="/login.html"})});async function C(){v(),b(),await x();let{response:t,data:e}=await f();if(!t.ok){window.location.replace("/login.html");return}if(e.role!=="admin"){window.location.replace("/dashboard.html");return}y(e),document.querySelectorAll("[data-admin-nav]").forEach(o=>{o.removeAttribute("hidden")}),await H()}a(C,"bootstrap");C()});export default q();
//# sourceMappingURL=prompts.js.map

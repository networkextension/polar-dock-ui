import{b as h,d as B}from"./chunk-BWAQIL2N.js";import{a as m,c as y}from"./chunk-JKVQ6N26.js";import{e as g,f as M,g as _}from"./chunk-5BXKLOML.js";import{a as v,c as f,d as E,i as d,l as T,n as k,q as H}from"./chunk-2IAD2NPJ.js";import{a as s,c as $}from"./chunk-BY6I6UVC.js";var x=$(()=>{E();H();_();y();T();B();var l=m("markdownList"),p=m("markdownLoadMoreBtn"),u=0,i=!0,o="own";g();M();function S(e){return new Date(e).toLocaleString()}s(S,"formatTime");function L(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}s(L,"escapeHtml");function b(e){let t=document.createElement("a");t.className="markdown-card panel",t.href=`/markdown.html?id=${e.id}`;let a=f(e.username,e.user_icon,64),n=e.cover_url?`<img class="markdown-card-cover" src="${v(e.cover_url)}" alt="${L(e.title)}" loading="lazy" />`:"",c=e.summary?`<div class="markdown-card-summary">${L(e.summary)}</div>`:"";return t.innerHTML=`
    <div class="post-header">
      <div class="post-author">
        <img class="avatar-sm" src="${a}" alt="${e.username}" />
        <span class="post-author-name">${e.username}</span>
      </div>
      <div class="post-time text-meta-mono">${S(e.uploaded_at)}</div>
    </div>
    ${n}
    <div class="markdown-card-title">${e.title}</div>
    ${c}
    <div class="markdown-card-meta">${d("markdowns.clickToView")}</div>
  `,t}s(b,"createMarkdownCard");async function w(e=!1){if(e&&(u=0,i=!0,l.innerHTML=""),!i)return;let t=(()=>{let r=`limit=10&offset=${u}`;switch(o){case"own":return`/api/markdown?${r}`;case"workspace":return`/api/markdown/workspace?${r}`;default:return`/api/public/markdowns?${r}`}})(),a=await fetch(t,{credentials:"include"}),n=await a.json();if(!a.ok){l.innerHTML=`<div class='post-empty'>${d("markdowns.loadFailed")}</div>`;return}let c=n.entries||[];if(e&&c.length===0){let r=o==="own"?"\u4F60\u8FD8\u6CA1\u6709 Markdown\uFF0C\u53BB Editor \u5199\u7B2C\u4E00\u7BC7\u5427":o==="workspace"?"\u5DE5\u4F5C\u533A\u91CC\u8FD8\u6CA1\u6709\u5171\u4EAB\u7684 Markdown":d("markdowns.noPosts");l.innerHTML=`<div class='post-empty'>${r}</div>`,i=!1,p.style.display="none";return}c.forEach(r=>{l.appendChild(b(r))}),i=!!n.has_more,u=Number(n.next_offset||0),p.style.display=i?"inline-flex":"none"}s(w,"loadMarkdowns");p.addEventListener("click",()=>{w(!1)});document.querySelectorAll("[data-scope]").forEach(e=>{e.addEventListener("click",()=>{let t=e.dataset.scope;!t||t===o||(o=t,document.querySelectorAll("[data-scope]").forEach(a=>{a.classList.toggle("is-active",a.dataset.scope===o)}),w(!0))})});k();w(!0);document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await h()}finally{window.location.replace("/login.html")}})});export default x();
//# sourceMappingURL=markdowns.js.map

import{a as Rt,b as _e}from"./chunk-PH5GIP5A.js";import{a as _,c as He}from"./chunk-KLFJCO5G.js";import{a as St,b as Ct,c as Dt,d as Te,e as rt,f as Me,g as Ft,h as we}from"./chunk-N3HGZ7XP.js";import{a as dt,b as Ie}from"./chunk-2DO3C5S5.js";import"./chunk-LRNBZIOC.js";import{H as Ae,c as jt,h as Nt,n as qt,u as Ot,v as Ut}from"./chunk-JAQKBYME.js";import"./chunk-TSVSLJUQ.js";import{b as Pt,d as he}from"./chunk-5BUHJZZT.js";import{a as l,b,c as be}from"./chunk-JKVQ6N26.js";import{b as Bt,c as xt,d as Ee}from"./chunk-LM6RPF4Z.js";import{c as m,e as ye}from"./chunk-C6HRAGLJ.js";import{a as f,c as N,d as ke,i as s,l as Le,r as Ht,s as It,u as $e}from"./chunk-QM6K7MLO.js";import{a as o,c as fe}from"./chunk-BY6I6UVC.js";var sn=fe(()=>{ke();Me();we();_e();Te();Ie();be();He();$e();Ee();Ae();Le();he();ye();var Be=l("postWelcome"),j=l("postDetail"),Vt=l("postForm"),G=l("postContent"),O=l("postType"),mt=l("postTag"),xe=l("taskFields"),Pe=l("taskLocation"),gt=l("taskStartAt"),vt=l("taskEndAt"),ft=l("workingHours"),yt=l("applyDeadline"),Re=l("postImages"),Se=l("postVideos"),q=l("postAttachments"),zt=l("postAttachmentChips"),T=l("postFormStatus"),Wt=l("postSubmitBtn"),bt=l("postAssistBot"),Xt=l("postAssistLLM"),Ce=l("postAssistTopic"),De=l("postAssistInstruction"),I=l("postAssistStatus"),ct=l("postAssistPreview"),U=l("postAssistRunBtn"),ut=l("postAssistApplyBtn"),kt="",Yt="user",$=[],tt=[],Gt=!1,S="",C="",D=null,M=null,L=null,V=null,Lt=null,et=null,nt=null,k=[],B=0,$t=[];Bt();xt();function Fe(){return new URLSearchParams(window.location.search).get("id")}o(Fe,"getPostId");function pt(t){return new Date(t).toISOString()}o(pt,"toISOStringFromLocal");function X(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}o(X,"escapeHtml");function F(t){return`/profile.html?user_id=${encodeURIComponent(t)}`}o(F,"profileUrl");function je(t){return t&&$t.find(e=>e.id===t)?.name||""}o(je,"getTagName");async function Zt(){if(!Gt){try{let[t,e]=await Promise.all([qt(),Nt()]);$=t.response.ok?t.data.bots||[]:[],tt=e.response.ok?e.data.configs||[]:[]}catch{$=[],tt=[]}Gt=!0,Ne()}}o(Zt,"loadAssistOptions");function Ne(){$.length?(bt.innerHTML=$.map(e=>`<option value="${e.id}">${e.name}${e.config_name?` \xB7 ${e.config_name}`:""}</option>`).join(""),U.disabled=!1):(bt.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`,U.disabled=!0);let t=tt.map(e=>`<option value="${e.id}">${e.name} \xB7 ${e.model}</option>`).join("");Xt.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${t}`}o(Ne,"renderPostAssistOptions");function qe(){let t=document.getElementById("postAssistPanel");t?.addEventListener("toggle",()=>{t.open&&Zt()}),U.addEventListener("click",async()=>{let e=Number(bt.value||0);if(e<=0){I.textContent=s("post.assistBotRequired");return}let n=Ce.value.trim(),a=G.value.trim();if(!n&&!a){I.textContent=s("post.assistTopicOrDraftRequired");return}U.disabled=!0,ut.disabled=!0,I.textContent=s("post.assistRunning");try{let i=Number(Xt.value||0),{response:r,data:d}=await Ot({bot_id:e,llm_config_id:i>0?i:void 0,content:a,topic:n,instruction:De.value.trim()});if(!r.ok||!d.content){I.textContent=d.error||s("post.assistFailed"),ct.hidden=!0,S="";return}S=d.content,ct.textContent=S,ct.hidden=!1,ut.disabled=!1;let v=d.llm?.model?` \xB7 ${d.llm.model}`:"",p=dt(d.usage);I.textContent=`${s("post.assistDone")}${v}${p}`}catch{I.textContent=s("common.networkError")}finally{U.disabled=$.length===0}}),ut.addEventListener("click",()=>{S&&(G.value=S,E?.setMarkdown(S),I.textContent=s("post.assistApplied"))})}o(qe,"setupPostAssistPanel");function Oe(t,e){$.length?t.innerHTML=$.map(a=>`<option value="${a.id}">${a.name}${a.config_name?` \xB7 ${a.config_name}`:""}</option>`).join(""):t.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`;let n=tt.map(a=>`<option value="${a.id}">${a.name} \xB7 ${a.model}</option>`).join("");e.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${n}`}o(Oe,"renderReplyAssistBotOptions");function Ue(t,e){let n=document.getElementById("replyAssistPanel");if(!n)return;let a=document.getElementById("replyAssistBot"),i=document.getElementById("replyAssistLLM"),r=document.getElementById("replyAssistInstruction"),d=document.getElementById("replyAssistRunBtn"),v=document.getElementById("replyAssistApplyBtn"),p=document.getElementById("replyAssistStatus"),g=document.getElementById("replyAssistPreview");!a||!i||!r||!d||!v||!p||!g||(n.addEventListener("toggle",async()=>{n.open&&(await Zt(),Oe(a,i),d.disabled=$.length===0)}),d.addEventListener("click",async()=>{let x=Number(a.value||0);if(x<=0){p.textContent=s("post.assistBotRequired");return}d.disabled=!0,v.disabled=!0,p.textContent=s("post.assistRunning");try{let w=Number(i.value||0),{response:J,data:h}=await Ut(t,{bot_id:x,llm_config_id:w>0?w:void 0,content:e.value.trim(),instruction:r.value.trim()});if(!J.ok||!h.content){p.textContent=h.error||s("post.assistFailed"),g.hidden=!0,C="";return}C=h.content,g.textContent=C,g.hidden=!1,v.disabled=!1;let at=h.llm?.model?` \xB7 ${h.llm.model}`:"",it=dt(h.usage);p.textContent=`${s("post.assistDone")}${at}${it}`}catch{p.textContent=s("common.networkError")}finally{d.disabled=$.length===0}}),v.addEventListener("click",()=>{C&&(e.value=C,p.textContent=s("post.assistApplied"))}))}o(Ue,"setupReplyAssist");async function Ve(){let{response:t,data:e}=await jt();t.ok&&($t=e.tags||[],mt.innerHTML=[`<option value="">${s("post.noSection")}</option>`,...$t.map(n=>`<option value="${n.id}">${n.name}</option>`)].join(""))}o(Ve,"loadTagOptions");function ze(){if(D)return;let t=document.createElement("div");t.className="video-modal",t.innerHTML=`
    <div class="video-modal-backdrop"></div>
    <div class="video-modal-content panel">
      <button class="video-modal-close btn-inline btn-secondary" type="button">${s("common.close")}</button>
      <video class="video-modal-player" controls autoplay preload="metadata"></video>
    </div>
  `,document.body.appendChild(t),D=t,M=b(t,".video-modal-player");let e=o(()=>{D&&(D.classList.remove("open"),M&&(M.pause(),M.removeAttribute("src"),M.load()))},"close");b(t,".video-modal-backdrop").addEventListener("click",e),b(t,".video-modal-close").addEventListener("click",e),document.addEventListener("keydown",n=>{n.key==="Escape"&&e()})}o(ze,"ensureVideoModal");function We(t){t&&(ze(),!(!D||!M)&&(M.src=t,D.classList.add("open"),M.play().catch(()=>{})))}o(We,"openVideoModal");function Ge(){if(L)return;let t=document.createElement("div");t.className="image-modal",t.innerHTML=`
    <div class="image-modal-backdrop"></div>
    <div class="image-modal-content">
      <div class="image-modal-toolbar">
        <div class="image-modal-counter">1 / 1</div>
        <button class="image-modal-close btn-inline btn-secondary" type="button">${s("common.close")}</button>
      </div>
      <div class="image-modal-stage">
        <button class="image-modal-nav image-modal-prev btn-inline btn-secondary" type="button" aria-label="${s("post.prevImage")}">${s("post.prevImage")}</button>
        <img class="image-modal-viewer" alt="post image preview" />
        <button class="image-modal-nav image-modal-next btn-inline btn-secondary" type="button" aria-label="${s("post.nextImage")}">${s("post.nextImage")}</button>
      </div>
    </div>
  `,document.body.appendChild(t),L=t,V=b(t,".image-modal-viewer"),Lt=b(t,".image-modal-counter"),et=b(t,".image-modal-prev"),nt=b(t,".image-modal-next");let e=o(()=>{!L||!V||(L.classList.remove("open"),V.removeAttribute("src"),k=[],B=0)},"close");b(t,".image-modal-backdrop").addEventListener("click",e),b(t,".image-modal-close").addEventListener("click",e),et.addEventListener("click",()=>Y(-1)),nt.addEventListener("click",()=>Y(1)),document.addEventListener("keydown",n=>{if(L?.classList.contains("open")){if(n.key==="Escape"){e();return}if(n.key==="ArrowLeft"){n.preventDefault(),Y(-1);return}n.key==="ArrowRight"&&(n.preventDefault(),Y(1))}})}o(Ge,"ensureImageModal");function te(){if(!L||!V||!Lt||!et||!nt)return;if(!k.length){L.classList.remove("open");return}B=(B+k.length)%k.length,V.src=k[B],Lt.textContent=`${B+1} / ${k.length}`;let t=k.length>1;et.disabled=!t,nt.disabled=!t}o(te,"renderImageModal");function ee(t,e){t.length&&(Ge(),L&&(k=t,B=e,te(),L.classList.add("open")))}o(ee,"openImageModal");function Y(t){k.length&&(B+=t,te())}o(Y,"stepImageModal");function Je(t){return Array.isArray(t.video_items)&&t.video_items.length>0?t.video_items.filter(e=>e&&e.url).map(e=>({url:f(e.url),posterUrl:e.poster_url?f(e.poster_url):""})):(t.videos||[]).map(e=>({url:f(e),posterUrl:""}))}o(Je,"normalizeVideoItems");function Jt(t,e){return Array.isArray(t.image_items)&&t.image_items.length>0?t.image_items.filter(n=>n&&(n.original_url||n.medium_url||n.small_url)).map(n=>e==="small"?f(n.small_url||n.medium_url||n.original_url):e==="medium"?f(n.medium_url||n.original_url||n.small_url):f(n.original_url||n.medium_url||n.small_url)):(t.images||[]).map(n=>f(n))}o(Jt,"normalizePostImages");function ne(t){t.querySelectorAll(".post-videos video").forEach(e=>{e.addEventListener("click",n=>{n.preventDefault(),n.stopPropagation();let a=e.querySelector("source"),i=e.currentSrc||a?.src||"";e.pause(),We(i)})})}o(ne,"enhancePostVideos");function Ke(t,e){t.querySelectorAll(".post-images img").forEach((n,a)=>{n.addEventListener("click",()=>{ee(e,a)})}),Qe(t)}o(Ke,"enhancePostImages");function Qe(t){let e=Array.from(t.querySelectorAll(".post-content img"));if(e.length===0)return;let n=e.map(a=>a.src);e.forEach((a,i)=>{a.style.cursor="zoom-in",a.addEventListener("click",r=>{r.stopPropagation(),ee(n,i)})})}o(Qe,"enhanceInlineImages");async function Xe(){let t=await m("/api/me");if(!t.ok){window.location.href="/login.html";return}let e=await t.json();kt=e.user_id,Yt=e.role||"user",Be.textContent=s("post.welcome",{username:e.username}),It(e)}o(Xe,"loadProfile");async function se(t){let e=document.getElementById("replyList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingReplies")}</div>`;let n=await m(`/api/posts/${t}/replies?limit=50`);if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.repliesLoadFailed")}</div>`;return}let i=(await n.json()).replies||[];if(i.length===0){e.innerHTML=`<div class='reply-empty'>${s("post.noReplies")}</div>`;return}e.innerHTML=i.map(r=>`
        <div class="reply-item">
          <img class="avatar-xs" src="${N(r.username,r.user_icon,48)}" alt="${r.username}" />
          <div class="reply-body">
            <div class="reply-meta">${r.username} \xB7 ${_(r.created_at)}</div>
            <div class="reply-content">${rt(r.content)}</div>
          </div>
        </div>
      `).join("")}o(se,"loadReplies");function Ye(t){let e=Jt(t,"medium"),n=Jt(t,"original"),a=e.map(c=>`<img src="${c}" alt="post image" loading="lazy" />`).join(""),i=Je(t).map(c=>`
        <video controls preload="metadata" ${c.posterUrl?`poster="${c.posterUrl}"`:""}>
          <source src="${c.url}" />
          ${s("post.videoNotSupported")}
        </video>
      `).join(""),r=i?`<div class="post-videos">${i}</div>`:"",d=kt&&t.user_id===kt,v=Yt==="admin"||d,p=t.post_type==="task"&&t.task,g=`<a class="post-author-name" href="${F(t.user_id)}">${t.username}</a>`,x=N(t.username,t.user_icon,64),w=p?`
      <div class="task-meta-card">
        <div class="badge">${s("post.gigTaskBadge")}</div>
        <div class="task-meta-grid">
          <div><strong>${s("post.timeRange")}</strong>${_(t.task.start_at)} - ${_(t.task.end_at)}</div>
          <div><strong>${s("post.workingHoursLabel")}</strong>${X(t.task.working_hours)}</div>
          <div><strong>${s("post.applyDeadline")}</strong>${_(t.task.apply_deadline)}</div>
          <div><strong>${s("post.location")}</strong>${X(t.task.location||s("post.noLocation"))}</div>
          <div><strong>${s("post.status")}</strong>${t.task.application_status==="open"?s("post.statusOpen"):s("post.statusClosed")}</div>
          <div><strong>${s("post.applicantCount")}</strong>${t.task.applicant_count||0}</div>
          ${t.task.selected_applicant_name?`<div><strong>${s("post.selectedApplicant")}</strong>${X(t.task.selected_applicant_name)}</div>`:""}
        </div>
      </div>
    `:"",J=je(t.tag_id),h=J?`<div class="tag-chip">${J}</div>`:"",at=p?`
      <div class="task-actions">
        ${t.task.can_apply?`<button id="taskApplyBtn" class="btn-inline btn-secondary" type="button">${t.task.applied_by_me?s("post.withdrawApplication"):s("post.applyTask")}</button>`:""}
        ${t.task.can_manage&&t.task.application_status==="open"?`<button id="taskCloseBtn" class="btn-inline btn-secondary" type="button">${s("post.closeApplications")}</button>
               <button id="taskLoadApplicantsBtn" class="btn-inline btn-secondary" type="button">${s("post.viewApplicants")}</button>`:""}
      </div>
      <div id="taskApplicantsPanel" class="task-applicants-panel"></div>
    `:"",it=p&&t.task.can_view_results?`
      <div class="task-results-card">
        <div class="badge">${s("post.taskResults")}</div>
        ${t.task.can_submit_result?`
              <form id="taskResultForm" class="task-result-form">
                <label class="form-label" for="taskResultNote">${s("post.resultDescription")}</label>
                <textarea id="taskResultNote" class="input textarea" rows="3" placeholder="${s("post.resultDescriptionPlaceholder")}"></textarea>
                <label class="form-label" for="taskResultImages">${s("post.resultImages")}</label>
                <input id="taskResultImages" class="input" type="file" accept="image/*" multiple />
                <label class="form-label" for="taskResultVideos">${s("post.resultVideos")}</label>
                <input id="taskResultVideos" class="input" type="file" accept="video/*" multiple />
                <div id="taskResultStatus" class="status-text"></div>
                <div class="task-form-actions">
                  <button id="taskResultSubmitBtn" class="btn-inline btn-secondary" type="submit">${s("post.submitResult")}</button>
                </div>
              </form>
            `:""}
        <div id="taskResultList" class="task-result-list"></div>
      </div>
    `:"";j.innerHTML=`
    <div class="post-header">
      <div class="post-author">
        <a href="${F(t.user_id)}"><img class="avatar-sm" src="${x}" alt="${t.username}" /></a>
        ${g}
      </div>
      <div class="post-time">${_(t.created_at)}</div>
    </div>
    <div class="post-content md-body">${Ft(t.content)}</div>
    ${h}
    ${w}
    <div class="post-images">${a}</div>
    ${r}
    ${Ze(t.attachments)}
    <div class="post-actions">
      <button id="detailLikeBtn" class="btn-inline btn-secondary" type="button">
        ${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}
      </button>
      ${v?`<button id="detailDeleteBtn" class="btn-inline btn-secondary" type="button">${s("post.deletePost")}</button>`:""}
    </div>
    ${at}
    ${it}
    <div class="reply-box open">
      <div class="reply-list" id="replyList"></div>
      <form id="replyForm" class="reply-form">
        <input id="replyInput" class="input reply-input" type="text" placeholder="${s("post.replyPlaceholder")}" required />
        <button class="btn-inline btn-secondary" type="submit">${s("post.sendReply")}</button>
      </form>
      <details id="replyAssistPanel" class="post-assist-panel">
        <summary class="post-assist-summary">${s("post.replyAssistToggle")}</summary>
        <div class="post-assist-body">
          <label class="form-label" for="replyAssistBot">${s("post.assistBot")}</label>
          <select id="replyAssistBot" class="input"></select>
          <label class="form-label" for="replyAssistLLM">${s("post.assistLLM")}</label>
          <select id="replyAssistLLM" class="input"></select>
          <label class="form-label" for="replyAssistInstruction">${s("post.assistInstruction")}</label>
          <input id="replyAssistInstruction" class="input" type="text" placeholder="${s("post.assistInstructionPlaceholder")}" />
          <div id="replyAssistStatus" class="status-text"></div>
          <div id="replyAssistPreview" class="post-assist-preview" hidden></div>
          <div class="task-form-actions">
            <button id="replyAssistRunBtn" class="btn-inline btn-secondary" type="button">${s("post.replyAssistRun")}</button>
            <button id="replyAssistApplyBtn" class="btn-inline btn-secondary" type="button" disabled>${s("post.replyAssistApply")}</button>
          </div>
        </div>
      </details>
    </div>
  `;let Tt=l("detailLikeBtn"),ot=document.getElementById("detailDeleteBtn");ne(j),Ke(j,n),Tt.addEventListener("click",async()=>{let c=t.liked_by_me?"DELETE":"POST";(await m(`/api/posts/${t.id}/like`,{method:c})).ok&&(t.liked_by_me=!t.liked_by_me,t.like_count+=t.liked_by_me?1:-1,Tt.textContent=`${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}`)}),ot?.addEventListener("click",async()=>{if(!window.confirm(s("post.confirmDelete")))return;if(ot.disabled=!0,!(await m(`/api/posts/${t.id}`,{method:"DELETE"})).ok){ot.disabled=!1;return}window.location.href="/posts.html"});let ce=l("replyForm"),lt=l("replyInput");C="",Ue(t.id,lt);let ue=document.getElementById("taskApplyBtn"),pe=document.getElementById("taskCloseBtn"),me=document.getElementById("taskLoadApplicantsBtn"),A=document.getElementById("taskApplicantsPanel"),Mt=document.getElementById("taskResultForm"),ge=document.getElementById("taskResultNote"),wt=document.getElementById("taskResultImages"),At=document.getElementById("taskResultVideos"),K=document.getElementById("taskResultStatus"),Q=document.getElementById("taskResultSubmitBtn");ce.addEventListener("submit",async c=>{c.preventDefault();let y=lt.value.trim();!y||!(await m(`/api/posts/${t.id}/replies`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:y})})).ok||(lt.value="",await se(t.id))}),ue?.addEventListener("click",async()=>{let c=t.task?.applied_by_me?"DELETE":"POST";(await m(`/api/tasks/${t.id}/apply`,{method:c})).ok&&await Z()}),pe?.addEventListener("click",async()=>{(await m(`/api/tasks/${t.id}/close`,{method:"POST"})).ok&&await Z()}),me?.addEventListener("click",async()=>{if(!A)return;A.innerHTML=`<div class='reply-empty'>${s("post.loadingApplicants")}</div>`;let c=await m(`/api/tasks/${t.id}/applications`);if(!c.ok){A.innerHTML=`<div class='reply-empty'>${s("post.applicantsLoadFailed")}</div>`;return}let P=(await c.json()).applications||[];if(!P.length){A.innerHTML=`<div class='reply-empty'>${s("post.noApplicants")}</div>`;return}A.innerHTML=P.map(u=>{let H=N(u.username,u.user_icon,40),R=t.task?.invitation_template||s("post.invitationDefault",{content:t.content});return`
          <div class="task-applicant-item">
            <div class="task-applicant-head">
              <a href="${F(u.user_id)}"><img class="avatar-xs" src="${H}" alt="${u.username}" /></a>
              <div>
                <div class="reply-meta"><a class="post-author-name" href="${F(u.user_id)}">${u.username}</a> \xB7 ${_(u.applied_at)}</div>
                <div class="task-applicant-id">${u.user_id}</div>
              </div>
            </div>
            <textarea class="input textarea task-template-input" data-user-id="${u.user_id}" rows="4">${X(R)}</textarea>
            <button class="btn-inline btn-secondary task-select-btn" data-user-id="${u.user_id}" type="button">${s("post.confirmAndMessage")}</button>
          </div>
        `}).join(""),A.querySelectorAll(".task-select-btn").forEach(u=>{u.addEventListener("click",async()=>{let H=u.dataset.userId;if(!H)return;let ve=A.querySelector(`.task-template-input[data-user-id="${H}"]`)?.value.trim()||"";if(u.disabled=!0,!(await m(`/api/tasks/${t.id}/select-candidate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicant_user_id:H,message_template:ve})})).ok){u.disabled=!1;return}await Z()})})}),Mt?.addEventListener("submit",async c=>{if(c.preventDefault(),!K||!Q||!wt||!At)return;let y=new FormData,P=ge?.value.trim()||"";P&&y.append("note",P),Array.from(wt.files||[]).forEach(R=>y.append("images",R)),Array.from(At.files||[]).forEach(R=>y.append("videos",R)),K.textContent=s("post.submittingResult"),Q.disabled=!0;let u=await m(`/api/tasks/${t.id}/results`,{method:"POST",body:y}),H=await u.json().catch(()=>({}));if(!u.ok){K.textContent=H.error||s("common.submitFailed"),Q.disabled=!1;return}K.textContent=s("post.resultSubmitted"),Mt.reset(),Q.disabled=!1,await Kt(t.id)}),t.task?.can_view_results&&Kt(t.id)}o(Ye,"renderPost");async function Kt(t){let e=document.getElementById("taskResultList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingResults")}</div>`;let n=await m(`/api/tasks/${t}/results`);if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.resultsLoadFailed")}</div>`;return}let i=(await n.json()).results||[];if(!i.length){e.innerHTML=`<div class='reply-empty'>${s("post.noResults")}</div>`;return}e.innerHTML=i.map(r=>{let d=N(r.username,r.user_icon,40),v=(r.images||[]).map(g=>`<img src="${f(g)}" alt="task result image" />`).join(""),p=(r.video_items||[]).map(g=>{let x=f(g.url),w=g.poster_url?f(g.poster_url):"";return`
            <video controls preload="metadata" ${w?`poster="${w}"`:""}>
              <source src="${x}" />
              ${s("post.videoNotSupported")}
            </video>
          `}).join("");return`
        <div class="task-result-item">
          <div class="task-applicant-head">
            <a href="${F(r.user_id)}"><img class="avatar-xs" src="${d}" alt="${r.username}" /></a>
            <div class="reply-meta"><a class="post-author-name" href="${F(r.user_id)}">${r.username}</a> \xB7 ${_(r.created_at)}</div>
          </div>
          ${r.note?`<div class="post-content">${rt(r.note)}</div>`:""}
          ${v?`<div class="post-images">${v}</div>`:""}
          ${p?`<div class="post-videos">${p}</div>`:""}
        </div>
      `}).join(""),ne(e)}o(Kt,"loadTaskResults");async function Z(){let t=Fe();if(!t){j.innerHTML=`<div class='post-empty'>${s("post.invalidPost")}</div>`;return}let e=await m(`/api/posts/${t}`);if(!e.ok){j.innerHTML=`<div class='post-empty'>${s("post.loadFailed")}</div>`;return}let a=(await e.json()).post||null;if(!a){j.innerHTML=`<div class='post-empty'>${s("post.notFound")}</div>`;return}Ye(a),await se(a.id)}o(Z,"loadPost");function ae(){let t=O.value==="task";xe.hidden=!t,gt.required=t,vt.required=t,ft.required=t,yt.required=t}o(ae,"syncTaskFields");O.addEventListener("change",ae);var z=[];function ie(){zt.innerHTML=z.map((t,e)=>`
        <span class="tag-chip" style="display:inline-flex; gap:6px; align-items:center;">
          \u{1F4CE} ${oe(t.filename)}
          <span style="color:var(--text-muted,#888); font-size:11px;">(${le(t.size)})</span>
          <button type="button" data-rm-att="${e}" style="background:none; border:none; color:#c33; cursor:pointer; padding:0; font-size:14px; line-height:1;">\xD7</button>
        </span>`).join(""),zt.querySelectorAll("[data-rm-att]").forEach(t=>{t.addEventListener("click",()=>{let e=Number(t.getAttribute("data-rm-att"));Number.isFinite(e)&&e>=0&&e<z.length&&(z.splice(e,1),ie())})})}o(ie,"renderAttachmentChips");function oe(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}o(oe,"escapeAttachmentName");function Ze(t){return!t||t.length===0?"":`<ul class="post-attachments" style="list-style:none; padding:0; margin:8px 0 0 0; display:flex; flex-direction:column; gap:6px;">${t.map(n=>`
        <li style="display:flex; gap:8px; align-items:center; padding:6px 8px; background:var(--card,#f7f7f9); border:1px solid var(--border,#ececf0); border-radius:6px;">
          <span style="font-size:14px;">\u{1F4CE}</span>
          <a href="${n.download_url}" download style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${oe(n.filename)}</a>
          <span style="color:var(--text-muted,#888); font-size:11px;">${le(n.size_bytes)}</span>
        </li>`).join("")}</ul>`}o(Ze,"renderPostAttachmentsList");function le(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`}o(le,"formatBytes");q.addEventListener("change",async()=>{let t=Array.from(q.files||[]);if(t.length){q.disabled=!0;for(let e of t)try{let n=new FormData;n.append("file",e);let a=await m("/api/attachments",{method:"POST",body:n}),i=await a.json();if(!a.ok||!i.attachment){T.textContent=`\u9644\u4EF6 "${e.name}" \u4E0A\u4F20\u5931\u8D25\uFF1A${i.error||"\u670D\u52A1\u5668\u9519\u8BEF"}`;continue}z.push({id:i.attachment.id,filename:i.attachment.filename,size:i.attachment.size_bytes})}catch{T.textContent=`\u9644\u4EF6 "${e.name}" \u4E0A\u4F20\u5931\u8D25`}q.value="",q.disabled=!1,ie()}});var Qt=l("postEditor"),re=l("postEditorToolbar"),W=l("postInlineImages"),E=null;Qt&&(E=Rt(Qt,{cssClass:"rich-prose",onChange:o(t=>{G.value=t},"onChange"),extensions:[St,Ct],setupMarkdown:Dt,editorProps:{handlePaste:o((t,e)=>{let n=Et(e.clipboardData?.files);return n.length===0?!1:(e.preventDefault(),ht(n,!1),!0)},"handlePaste"),handleDrop:o((t,e)=>{let n=Et(e.dataTransfer?.files);return n.length===0?!1:(e.preventDefault(),ht(n,!1),!0)},"handleDrop")}}),en(re,E));function Et(t){return Array.from(t||[]).filter(e=>e.type.startsWith("image/"))}o(Et,"imageFiles");async function de(t){let e=new FormData;e.append("file",t);try{let n=await m("/api/posts/media",{method:"POST",body:e}),a=await n.json();return!n.ok||!a.url?(window.alert(a.error||`\u4E0A\u4F20\u5931\u8D25\uFF1A${t.name}`),null):a}catch{return window.alert(`\u4E0A\u4F20\u5931\u8D25\uFF1A${t.name}`),null}}o(de,"uploadInlineImage");function st(t){re?.querySelectorAll('[data-cmd="figure"], [data-cmd="gallery"]').forEach(e=>{e.disabled=t,e.style.opacity=t?"0.5":""})}o(st,"setInlineUploadBusy");async function ht(t,e){if(E){st(!0);try{for(let n of t){let a=await de(n);if(!a)continue;let i=e&&t.length===1?(window.prompt("\u56FE\u7247\u8BF4\u660E\uFF08\u53EF\u7559\u7A7A\uFF09","")||"").trim():"";E.editor.chain().focus().insertContent({type:"polarFigure",attrs:{src:a.url,alt:n.name.replace(/\.[a-z0-9]+$/i,""),caption:i,align:"center",width:""}}).run()}}finally{st(!1)}}}o(ht,"insertFigures");async function tn(t){if(E){st(!0);try{let e=[];for(let n of t){let a=await de(n);a&&e.push({src:a.url,alt:n.name.replace(/\.[a-z0-9]+$/i,"")})}if(e.length===0)return;E.editor.chain().focus().insertContent({type:"polarGallery",attrs:{images:e}}).run()}finally{st(!1)}}}o(tn,"insertGallery");var _t="figure";W?.addEventListener("change",()=>{let t=Et(W.files);W.value="",t.length!==0&&(_t==="gallery"&&t.length>1?tn(t):ht(t,!0))});function en(t,e){t&&t.addEventListener("click",n=>{let a=n.target.closest("[data-cmd]");if(!a)return;n.preventDefault();let i=e.editor.chain().focus();switch(a.dataset.cmd){case"bold":i.toggleBold().run();break;case"italic":i.toggleItalic().run();break;case"strike":i.toggleStrike().run();break;case"h2":i.toggleHeading({level:2}).run();break;case"bulletList":i.toggleBulletList().run();break;case"orderedList":i.toggleOrderedList().run();break;case"blockquote":i.toggleBlockquote().run();break;case"code":i.toggleCode().run();break;case"codeBlock":i.toggleCodeBlock().run();break;case"link":{let r=e.editor.getAttributes("link").href,d=window.prompt("Link URL",r||"https://");if(d===null){i.run();return}if(d.trim()===""){i.extendMarkRange("link").unsetLink().run();return}i.extendMarkRange("link").setLink({href:d.trim()}).run();break}case"figure":_t="figure",i.run(),W?.click();return;case"gallery":_t="gallery",i.run(),W?.click();return;default:i.run()}})}o(en,"wireRichToolbar");Vt.addEventListener("submit",async t=>{t.preventDefault(),E&&(G.value=E.getMarkdown());let e=G.value.trim();if(!e){T.textContent=s("post.contentRequired");return}if(O.value==="task"&&(!gt.value||!vt.value||!ft.value.trim()||!yt.value)){T.textContent=s("post.taskInfoRequired");return}T.textContent=s("post.publishing"),Wt.disabled=!0;let n=new FormData;n.append("post_type",O.value),mt.value&&n.append("tag_id",mt.value),n.append("content",e),O.value==="task"&&(n.append("task_location",Pe.value.trim()),n.append("task_start_at",pt(gt.value)),n.append("task_end_at",pt(vt.value)),n.append("working_hours",ft.value.trim()),n.append("apply_deadline",pt(yt.value))),Array.from(Re.files||[]).forEach(a=>{n.append("images",a)}),Array.from(Se.files||[]).forEach(a=>{n.append("videos",a)});for(let a of z)n.append("attachment_ids",a.id);try{let a=await m("/api/posts",{method:"POST",body:n}),i=await a.json();if(!a.ok){T.textContent=i.error||s("post.publishFailed");return}T.textContent=s("post.publishSuccess"),Vt.reset(),window.location.href=`/post.html?id=${i.id}`}catch{T.textContent=s("post.publishFailedRetry")}finally{Wt.disabled=!1}});async function nn(){await Ht(),await Xe(),await Ve(),ae(),qe(),await Z()}o(nn,"init");nn();document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await Pt()}finally{window.location.replace("/login.html")}})});export default sn();
//# sourceMappingURL=post.js.map

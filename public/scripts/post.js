import{a as it,b as ce}from"./chunk-2DO3C5S5.js";import{E as de,c as Bt,h as wt,m as It,r as xt,s as St}from"./chunk-F7Z3AZTG.js";import{b as Ht,d as re}from"./chunk-BWAQIL2N.js";import{a as o,b,c as ne}from"./chunk-JKVQ6N26.js";import{e as Mt,f as At,g as le}from"./chunk-5BXKLOML.js";import{a as f,c as j,d as ae,i as s,l as ie,n as Et,o as Tt,q as oe}from"./chunk-ZLMDOPIP.js";import{a as i,c as se}from"./chunk-BY6I6UVC.js";var Ce=se(()=>{ae();ce();ne();oe();le();de();ie();re();var m="",ue=o("postWelcome"),F=o("postDetail"),Pt=o("postForm"),dt=o("postContent"),q=o("postType"),ct=o("postTag"),pe=o("taskFields"),me=o("taskLocation"),ut=o("taskStartAt"),pt=o("taskEndAt"),mt=o("workingHours"),vt=o("applyDeadline"),ve=o("postImages"),ge=o("postVideos"),N=o("postAttachments"),Rt=o("postAttachmentChips"),$=o("postFormStatus"),gt=o("postSubmitBtn"),ft=o("postAssistBot"),Nt=o("postAssistLLM"),fe=o("postAssistTopic"),ye=o("postAssistInstruction"),B=o("postAssistStatus"),ot=o("postAssistPreview"),V=o("postAssistRunBtn"),lt=o("postAssistApplyBtn"),yt="",Ot="user",_=[],Y=[],Ct=!1,O="",R="",C=null,T=null,L=null,z=null,bt=null,Z=null,tt=null,k=[],I=0,$t=[];Mt();At();function be(){return new URLSearchParams(window.location.search).get("id")}i(be,"getPostId");function w(t){return new Date(t).toLocaleString()}i(w,"formatTime");function rt(t){return new Date(t).toISOString()}i(rt,"toISOStringFromLocal");function U(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}i(U,"escapeHtml");function D(t){return`/profile.html?user_id=${encodeURIComponent(t)}`}i(D,"profileUrl");function $e(t){return t&&$t.find(e=>e.id===t)?.name||""}i($e,"getTagName");async function Ut(){if(!Ct){try{let[t,e]=await Promise.all([It(),wt()]);_=t.response.ok?t.data.bots||[]:[],Y=e.response.ok?e.data.configs||[]:[]}catch{_=[],Y=[]}Ct=!0,ke()}}i(Ut,"loadAssistOptions");function ke(){_.length?(ft.innerHTML=_.map(e=>`<option value="${e.id}">${e.name}${e.config_name?` \xB7 ${e.config_name}`:""}</option>`).join(""),V.disabled=!1):(ft.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`,V.disabled=!0);let t=Y.map(e=>`<option value="${e.id}">${e.name} \xB7 ${e.model}</option>`).join("");Nt.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${t}`}i(ke,"renderPostAssistOptions");function Le(){let t=document.getElementById("postAssistPanel");t?.addEventListener("toggle",()=>{t.open&&Ut()}),V.addEventListener("click",async()=>{let e=Number(ft.value||0);if(e<=0){B.textContent=s("post.assistBotRequired");return}let n=fe.value.trim(),a=dt.value.trim();if(!n&&!a){B.textContent=s("post.assistTopicOrDraftRequired");return}V.disabled=!0,lt.disabled=!0,B.textContent=s("post.assistRunning");try{let r=Number(Nt.value||0),{response:l,data:u}=await xt({bot_id:e,llm_config_id:r>0?r:void 0,content:a,topic:n,instruction:ye.value.trim()});if(!l.ok||!u.content){B.textContent=u.error||s("post.assistFailed"),ot.hidden=!0,O="";return}O=u.content,ot.textContent=O,ot.hidden=!1,lt.disabled=!1;let g=u.llm?.model?` \xB7 ${u.llm.model}`:"",p=it(u.usage);B.textContent=`${s("post.assistDone")}${g}${p}`}catch{B.textContent=s("common.networkError")}finally{V.disabled=_.length===0}}),lt.addEventListener("click",()=>{O&&(dt.value=O,B.textContent=s("post.assistApplied"))})}i(Le,"setupPostAssistPanel");function he(t,e){_.length?t.innerHTML=_.map(a=>`<option value="${a.id}">${a.name}${a.config_name?` \xB7 ${a.config_name}`:""}</option>`).join(""):t.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`;let n=Y.map(a=>`<option value="${a.id}">${a.name} \xB7 ${a.model}</option>`).join("");e.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${n}`}i(he,"renderReplyAssistBotOptions");function _e(t,e){let n=document.getElementById("replyAssistPanel");if(!n)return;let a=document.getElementById("replyAssistBot"),r=document.getElementById("replyAssistLLM"),l=document.getElementById("replyAssistInstruction"),u=document.getElementById("replyAssistRunBtn"),g=document.getElementById("replyAssistApplyBtn"),p=document.getElementById("replyAssistStatus"),v=document.getElementById("replyAssistPreview");!a||!r||!l||!u||!g||!p||!v||(n.addEventListener("toggle",async()=>{n.open&&(await Ut(),he(a,r),u.disabled=_.length===0)}),u.addEventListener("click",async()=>{let x=Number(a.value||0);if(x<=0){p.textContent=s("post.assistBotRequired");return}u.disabled=!0,g.disabled=!0,p.textContent=s("post.assistRunning");try{let M=Number(r.value||0),{response:J,data:E}=await St(t,{bot_id:x,llm_config_id:M>0?M:void 0,content:e.value.trim(),instruction:l.value.trim()});if(!J.ok||!E.content){p.textContent=E.error||s("post.assistFailed"),v.hidden=!0,R="";return}R=E.content,v.textContent=R,v.hidden=!1,g.disabled=!1;let et=E.llm?.model?` \xB7 ${E.llm.model}`:"",st=it(E.usage);p.textContent=`${s("post.assistDone")}${et}${st}`}catch{p.textContent=s("common.networkError")}finally{u.disabled=_.length===0}}),g.addEventListener("click",()=>{R&&(e.value=R,p.textContent=s("post.assistApplied"))}))}i(_e,"setupReplyAssist");async function Ee(){let{response:t,data:e}=await Bt();t.ok&&($t=e.tags||[],ct.innerHTML=[`<option value="">${s("post.noSection")}</option>`,...$t.map(n=>`<option value="${n.id}">${n.name}</option>`)].join(""))}i(Ee,"loadTagOptions");function Te(){if(C)return;let t=document.createElement("div");t.className="video-modal",t.innerHTML=`
    <div class="video-modal-backdrop"></div>
    <div class="video-modal-content panel">
      <button class="video-modal-close btn-inline btn-secondary" type="button">${s("common.close")}</button>
      <video class="video-modal-player" controls autoplay preload="metadata"></video>
    </div>
  `,document.body.appendChild(t),C=t,T=b(t,".video-modal-player");let e=i(()=>{C&&(C.classList.remove("open"),T&&(T.pause(),T.removeAttribute("src"),T.load()))},"close");b(t,".video-modal-backdrop").addEventListener("click",e),b(t,".video-modal-close").addEventListener("click",e),document.addEventListener("keydown",n=>{n.key==="Escape"&&e()})}i(Te,"ensureVideoModal");function Me(t){t&&(Te(),!(!C||!T)&&(T.src=t,C.classList.add("open"),T.play().catch(()=>{})))}i(Me,"openVideoModal");function Ae(){if(L)return;let t=document.createElement("div");t.className="image-modal",t.innerHTML=`
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
  `,document.body.appendChild(t),L=t,z=b(t,".image-modal-viewer"),bt=b(t,".image-modal-counter"),Z=b(t,".image-modal-prev"),tt=b(t,".image-modal-next");let e=i(()=>{!L||!z||(L.classList.remove("open"),z.removeAttribute("src"),k=[],I=0)},"close");b(t,".image-modal-backdrop").addEventListener("click",e),b(t,".image-modal-close").addEventListener("click",e),Z.addEventListener("click",()=>Q(-1)),tt.addEventListener("click",()=>Q(1)),document.addEventListener("keydown",n=>{if(L?.classList.contains("open")){if(n.key==="Escape"){e();return}if(n.key==="ArrowLeft"){n.preventDefault(),Q(-1);return}n.key==="ArrowRight"&&(n.preventDefault(),Q(1))}})}i(Ae,"ensureImageModal");function qt(){if(!L||!z||!bt||!Z||!tt)return;if(!k.length){L.classList.remove("open");return}I=(I+k.length)%k.length,z.src=k[I],bt.textContent=`${I+1} / ${k.length}`;let t=k.length>1;Z.disabled=!t,tt.disabled=!t}i(qt,"renderImageModal");function He(t,e){t.length&&(Ae(),L&&(k=t,I=e,qt(),L.classList.add("open")))}i(He,"openImageModal");function Q(t){k.length&&(I+=t,qt())}i(Q,"stepImageModal");function Be(t){return Array.isArray(t.video_items)&&t.video_items.length>0?t.video_items.filter(e=>e&&e.url).map(e=>({url:f(e.url),posterUrl:e.poster_url?f(e.poster_url):""})):(t.videos||[]).map(e=>({url:f(e),posterUrl:""}))}i(Be,"normalizeVideoItems");function Dt(t,e){return Array.isArray(t.image_items)&&t.image_items.length>0?t.image_items.filter(n=>n&&(n.original_url||n.medium_url||n.small_url)).map(n=>e==="small"?f(n.small_url||n.medium_url||n.original_url):e==="medium"?f(n.medium_url||n.original_url||n.small_url):f(n.original_url||n.medium_url||n.small_url)):(t.images||[]).map(n=>f(n))}i(Dt,"normalizePostImages");function Vt(t){t.querySelectorAll(".post-videos video").forEach(e=>{e.addEventListener("click",n=>{n.preventDefault(),n.stopPropagation();let a=e.querySelector("source"),r=e.currentSrc||a?.src||"";e.pause(),Me(r)})})}i(Vt,"enhancePostVideos");function we(t,e){t.querySelectorAll(".post-images img").forEach((n,a)=>{n.addEventListener("click",()=>{He(e,a)})})}i(we,"enhancePostImages");async function Ie(){let t=await fetch(`${m}/api/me`,{credentials:"include"});if(!t.ok){window.location.href="/login.html";return}let e=await t.json();yt=e.user_id,Ot=e.role||"user",ue.textContent=s("post.welcome",{username:e.username}),Tt(e)}i(Ie,"loadProfile");async function zt(t){let e=document.getElementById("replyList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingReplies")}</div>`;let n=await fetch(`${m}/api/posts/${t}/replies?limit=50`,{credentials:"include"});if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.repliesLoadFailed")}</div>`;return}let r=(await n.json()).replies||[];if(r.length===0){e.innerHTML=`<div class='reply-empty'>${s("post.noReplies")}</div>`;return}e.innerHTML=r.map(l=>`
        <div class="reply-item">
          <img class="avatar-xs" src="${j(l.username,l.user_icon,48)}" alt="${l.username}" />
          <div class="reply-body">
            <div class="reply-meta">${l.username} \xB7 ${w(l.created_at)}</div>
            <div class="reply-content">${l.content}</div>
          </div>
        </div>
      `).join("")}i(zt,"loadReplies");function xe(t){let e=Dt(t,"medium"),n=Dt(t,"original"),a=e.map(d=>`<img src="${d}" alt="post image" loading="lazy" />`).join(""),r=Be(t).map(d=>`
        <video controls preload="metadata" ${d.posterUrl?`poster="${d.posterUrl}"`:""}>
          <source src="${d.url}" />
          ${s("post.videoNotSupported")}
        </video>
      `).join(""),l=r?`<div class="post-videos">${r}</div>`:"",u=yt&&t.user_id===yt,g=Ot==="admin"||u,p=t.post_type==="task"&&t.task,v=`<a class="post-author-name" href="${D(t.user_id)}">${t.username}</a>`,x=j(t.username,t.user_icon,64),M=p?`
      <div class="task-meta-card">
        <div class="badge">${s("post.gigTaskBadge")}</div>
        <div class="task-meta-grid">
          <div><strong>${s("post.timeRange")}</strong>${w(t.task.start_at)} - ${w(t.task.end_at)}</div>
          <div><strong>${s("post.workingHoursLabel")}</strong>${U(t.task.working_hours)}</div>
          <div><strong>${s("post.applyDeadline")}</strong>${w(t.task.apply_deadline)}</div>
          <div><strong>${s("post.location")}</strong>${U(t.task.location||s("post.noLocation"))}</div>
          <div><strong>${s("post.status")}</strong>${t.task.application_status==="open"?s("post.statusOpen"):s("post.statusClosed")}</div>
          <div><strong>${s("post.applicantCount")}</strong>${t.task.applicant_count||0}</div>
          ${t.task.selected_applicant_name?`<div><strong>${s("post.selectedApplicant")}</strong>${U(t.task.selected_applicant_name)}</div>`:""}
        </div>
      </div>
    `:"",J=$e(t.tag_id),E=J?`<div class="tag-chip">${J}</div>`:"",et=p?`
      <div class="task-actions">
        ${t.task.can_apply?`<button id="taskApplyBtn" class="btn-inline btn-secondary" type="button">${t.task.applied_by_me?s("post.withdrawApplication"):s("post.applyTask")}</button>`:""}
        ${t.task.can_manage&&t.task.application_status==="open"?`<button id="taskCloseBtn" class="btn-inline btn-secondary" type="button">${s("post.closeApplications")}</button>
               <button id="taskLoadApplicantsBtn" class="btn-inline btn-secondary" type="button">${s("post.viewApplicants")}</button>`:""}
      </div>
      <div id="taskApplicantsPanel" class="task-applicants-panel"></div>
    `:"",st=p&&t.task.can_view_results?`
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
    `:"";F.innerHTML=`
    <div class="post-header">
      <div class="post-author">
        <a href="${D(t.user_id)}"><img class="avatar-sm" src="${x}" alt="${t.username}" /></a>
        ${v}
      </div>
      <div class="post-time">${w(t.created_at)}</div>
    </div>
    <div class="post-content">${t.content}</div>
    ${E}
    ${M}
    <div class="post-images">${a}</div>
    ${l}
    ${Se(t.attachments)}
    <div class="post-actions">
      <button id="detailLikeBtn" class="btn-inline btn-secondary" type="button">
        ${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}
      </button>
      ${g?`<button id="detailDeleteBtn" class="btn-inline btn-secondary" type="button">${s("post.deletePost")}</button>`:""}
    </div>
    ${et}
    ${st}
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
  `;let kt=o("detailLikeBtn"),nt=document.getElementById("detailDeleteBtn");Vt(F),we(F,n),kt.addEventListener("click",async()=>{let d=t.liked_by_me?"DELETE":"POST";(await fetch(`${m}/api/posts/${t.id}/like`,{method:d,credentials:"include"})).ok&&(t.liked_by_me=!t.liked_by_me,t.like_count+=t.liked_by_me?1:-1,kt.textContent=`${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}`)}),nt?.addEventListener("click",async()=>{if(!window.confirm(s("post.confirmDelete")))return;if(nt.disabled=!0,!(await fetch(`${m}/api/posts/${t.id}`,{method:"DELETE",credentials:"include"})).ok){nt.disabled=!1;return}window.location.href="/posts.html"});let Qt=o("replyForm"),at=o("replyInput");R="",_e(t.id,at);let Xt=document.getElementById("taskApplyBtn"),Yt=document.getElementById("taskCloseBtn"),Zt=document.getElementById("taskLoadApplicantsBtn"),A=document.getElementById("taskApplicantsPanel"),Lt=document.getElementById("taskResultForm"),te=document.getElementById("taskResultNote"),ht=document.getElementById("taskResultImages"),_t=document.getElementById("taskResultVideos"),G=document.getElementById("taskResultStatus"),K=document.getElementById("taskResultSubmitBtn");Qt.addEventListener("submit",async d=>{d.preventDefault();let y=at.value.trim();!y||!(await fetch(`${m}/api/posts/${t.id}/replies`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({content:y})})).ok||(at.value="",await zt(t.id))}),Xt?.addEventListener("click",async()=>{let d=t.task?.applied_by_me?"DELETE":"POST";(await fetch(`${m}/api/tasks/${t.id}/apply`,{method:d,credentials:"include"})).ok&&await X()}),Yt?.addEventListener("click",async()=>{(await fetch(`${m}/api/tasks/${t.id}/close`,{method:"POST",credentials:"include"})).ok&&await X()}),Zt?.addEventListener("click",async()=>{if(!A)return;A.innerHTML=`<div class='reply-empty'>${s("post.loadingApplicants")}</div>`;let d=await fetch(`${m}/api/tasks/${t.id}/applications`,{credentials:"include"});if(!d.ok){A.innerHTML=`<div class='reply-empty'>${s("post.applicantsLoadFailed")}</div>`;return}let S=(await d.json()).applications||[];if(!S.length){A.innerHTML=`<div class='reply-empty'>${s("post.noApplicants")}</div>`;return}A.innerHTML=S.map(c=>{let H=j(c.username,c.user_icon,40),P=t.task?.invitation_template||s("post.invitationDefault",{content:t.content});return`
          <div class="task-applicant-item">
            <div class="task-applicant-head">
              <a href="${D(c.user_id)}"><img class="avatar-xs" src="${H}" alt="${c.username}" /></a>
              <div>
                <div class="reply-meta"><a class="post-author-name" href="${D(c.user_id)}">${c.username}</a> \xB7 ${w(c.applied_at)}</div>
                <div class="task-applicant-id">${c.user_id}</div>
              </div>
            </div>
            <textarea class="input textarea task-template-input" data-user-id="${c.user_id}" rows="4">${U(P)}</textarea>
            <button class="btn-inline btn-secondary task-select-btn" data-user-id="${c.user_id}" type="button">${s("post.confirmAndMessage")}</button>
          </div>
        `}).join(""),A.querySelectorAll(".task-select-btn").forEach(c=>{c.addEventListener("click",async()=>{let H=c.dataset.userId;if(!H)return;let ee=A.querySelector(`.task-template-input[data-user-id="${H}"]`)?.value.trim()||"";if(c.disabled=!0,!(await fetch(`${m}/api/tasks/${t.id}/select-candidate`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({applicant_user_id:H,message_template:ee})})).ok){c.disabled=!1;return}await X()})})}),Lt?.addEventListener("submit",async d=>{if(d.preventDefault(),!G||!K||!ht||!_t)return;let y=new FormData,S=te?.value.trim()||"";S&&y.append("note",S),Array.from(ht.files||[]).forEach(P=>y.append("images",P)),Array.from(_t.files||[]).forEach(P=>y.append("videos",P)),G.textContent=s("post.submittingResult"),K.disabled=!0;let c=await fetch(`${m}/api/tasks/${t.id}/results`,{method:"POST",credentials:"include",body:y}),H=await c.json().catch(()=>({}));if(!c.ok){G.textContent=H.error||s("common.submitFailed"),K.disabled=!1;return}G.textContent=s("post.resultSubmitted"),Lt.reset(),K.disabled=!1,await Ft(t.id)}),t.task?.can_view_results&&Ft(t.id)}i(xe,"renderPost");async function Ft(t){let e=document.getElementById("taskResultList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingResults")}</div>`;let n=await fetch(`${m}/api/tasks/${t}/results`,{credentials:"include"});if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.resultsLoadFailed")}</div>`;return}let r=(await n.json()).results||[];if(!r.length){e.innerHTML=`<div class='reply-empty'>${s("post.noResults")}</div>`;return}e.innerHTML=r.map(l=>{let u=j(l.username,l.user_icon,40),g=(l.images||[]).map(v=>`<img src="${f(v)}" alt="task result image" />`).join(""),p=(l.video_items||[]).map(v=>{let x=f(v.url),M=v.poster_url?f(v.poster_url):"";return`
            <video controls preload="metadata" ${M?`poster="${M}"`:""}>
              <source src="${x}" />
              ${s("post.videoNotSupported")}
            </video>
          `}).join("");return`
        <div class="task-result-item">
          <div class="task-applicant-head">
            <a href="${D(l.user_id)}"><img class="avatar-xs" src="${u}" alt="${l.username}" /></a>
            <div class="reply-meta"><a class="post-author-name" href="${D(l.user_id)}">${l.username}</a> \xB7 ${w(l.created_at)}</div>
          </div>
          ${l.note?`<div class="post-content">${U(l.note)}</div>`:""}
          ${g?`<div class="post-images">${g}</div>`:""}
          ${p?`<div class="post-videos">${p}</div>`:""}
        </div>
      `}).join(""),Vt(e)}i(Ft,"loadTaskResults");async function X(){let t=be();if(!t){F.innerHTML=`<div class='post-empty'>${s("post.invalidPost")}</div>`;return}let e=await fetch(`${m}/api/posts/${t}`,{credentials:"include"});if(!e.ok){F.innerHTML=`<div class='post-empty'>${s("post.loadFailed")}</div>`;return}let a=(await e.json()).post||null;if(!a){F.innerHTML=`<div class='post-empty'>${s("post.notFound")}</div>`;return}xe(a),await zt(a.id)}i(X,"loadPost");function Wt(){let t=q.value==="task";pe.hidden=!t,ut.required=t,pt.required=t,mt.required=t,vt.required=t}i(Wt,"syncTaskFields");q.addEventListener("change",Wt);var W=[],h=[];function Jt(){Rt.innerHTML=W.map((t,e)=>`
        <span class="tag-chip" style="display:inline-flex; gap:6px; align-items:center;">
          \u{1F4CE} ${Gt(t.filename)}
          <span style="color:var(--text-muted,#888); font-size:11px;">(${Kt(t.size)})</span>
          <button type="button" data-rm-att="${e}" style="background:none; border:none; color:#c33; cursor:pointer; padding:0; font-size:14px; line-height:1;">\xD7</button>
        </span>`).join(""),Rt.querySelectorAll("[data-rm-att]").forEach(t=>{t.addEventListener("click",()=>{let e=Number(t.getAttribute("data-rm-att"));Number.isFinite(e)&&e>=0&&e<W.length&&(W.splice(e,1),Jt())})})}i(Jt,"renderAttachmentChips");function Gt(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}i(Gt,"escapeAttachmentName");function Se(t){return!t||t.length===0?"":`<ul class="post-attachments" style="list-style:none; padding:0; margin:8px 0 0 0; display:flex; flex-direction:column; gap:6px;">${t.map(n=>`
        <li style="display:flex; gap:8px; align-items:center; padding:6px 8px; background:var(--card,#f7f7f9); border:1px solid var(--border,#ececf0); border-radius:6px;">
          <span style="font-size:14px;">\u{1F4CE}</span>
          <a href="${n.download_url}" download style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Gt(n.filename)}</a>
          <span style="color:var(--text-muted,#888); font-size:11px;">${Kt(n.size_bytes)}</span>
        </li>`).join("")}</ul>`}i(Se,"renderPostAttachmentsList");function Kt(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`}i(Kt,"formatBytes");async function Pe(t){try{let e=new FormData;e.append("file",t);let n=await fetch(`${m}/api/attachments`,{method:"POST",credentials:"include",body:e}),a={};try{a=await n.json()}catch{a={error:`\u670D\u52A1\u5668\u8FD4\u56DE\u975E JSON (HTTP ${n.status})`}}if(!n.ok||!a.attachment){$.textContent=`\u9644\u4EF6 "${t.name}" \u4E0A\u4F20\u5931\u8D25\uFF1A${a.error||"\u670D\u52A1\u5668\u9519\u8BEF"}`;return}W.push({id:a.attachment.id,filename:a.attachment.filename,size:a.attachment.size_bytes}),Jt()}catch{$.textContent=`\u9644\u4EF6 "${t.name}" \u4E0A\u4F20\u5931\u8D25`}}i(Pe,"uploadOneAttachment");function jt(){let t=h.length>0;gt.disabled=t,t&&($.textContent=`\u9644\u4EF6\u4E0A\u4F20\u4E2D\uFF08${h.length}\uFF09\u2026`)}i(jt,"updateSubmitBtnForUploads");N.addEventListener("change",()=>{let t=Array.from(N.files||[]);if(t.length){N.disabled=!0,N.value="";for(let e of t){let n=Pe(e).finally(()=>{let a=h.indexOf(n);a>=0&&h.splice(a,1),jt(),h.length===0&&(N.disabled=!1)});h.push(n)}jt()}});Pt.addEventListener("submit",async t=>{t.preventDefault();let e=dt.value.trim();if(!e){$.textContent=s("post.contentRequired");return}if(q.value==="task"&&(!ut.value||!pt.value||!mt.value.trim()||!vt.value)){$.textContent=s("post.taskInfoRequired");return}h.length>0&&($.textContent=`\u7B49\u5F85\u9644\u4EF6\u4E0A\u4F20\u5B8C\u6210\uFF08${h.length}\uFF09\u2026`,await Promise.allSettled(h)),$.textContent=s("post.publishing"),gt.disabled=!0;let n=new FormData;n.append("post_type",q.value),ct.value&&n.append("tag_id",ct.value),n.append("content",e),q.value==="task"&&(n.append("task_location",me.value.trim()),n.append("task_start_at",rt(ut.value)),n.append("task_end_at",rt(pt.value)),n.append("working_hours",mt.value.trim()),n.append("apply_deadline",rt(vt.value))),Array.from(ve.files||[]).forEach(a=>{n.append("images",a)}),Array.from(ge.files||[]).forEach(a=>{n.append("videos",a)});for(let a of W)n.append("attachment_ids",a.id);try{let a=await fetch(`${m}/api/posts`,{method:"POST",credentials:"include",body:n}),r=await a.json();if(!a.ok){$.textContent=r.error||s("post.publishFailed");return}$.textContent=s("post.publishSuccess"),Pt.reset(),window.location.href=`/post.html?id=${r.id}`}catch{$.textContent=s("post.publishFailedRetry")}finally{gt.disabled=!1}});async function Re(){await Et(),await Ie(),await Ee(),Wt(),Le(),await X()}i(Re,"init");Re();document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await Ht()}finally{window.location.replace("/login.html")}})});export default Ce();
//# sourceMappingURL=post.js.map

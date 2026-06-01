import{a as at,b as re}from"./chunk-2DO3C5S5.js";import{E as le,c as At,h as Ht,m as Bt,r as It,s as wt}from"./chunk-GGJI3ARB.js";import{b as Mt,d as oe}from"./chunk-M2SL36VC.js";import{a as o,b,c as ee}from"./chunk-JKVQ6N26.js";import{e as Et,f as Tt,g as ie}from"./chunk-6CRS2GFD.js";import{a as f,c as F,d as se,i as s,l as ne,q as _t,r as ht,t as ae}from"./chunk-S2ZTB4DM.js";import{a as i,c as te}from"./chunk-BY6I6UVC.js";var Re=te(()=>{se();re();ee();ae();ie();le();ne();oe();var m="",de=o("postWelcome"),D=o("postDetail"),xt=o("postForm"),rt=o("postContent"),q=o("postType"),dt=o("postTag"),ce=o("taskFields"),ue=o("taskLocation"),ct=o("taskStartAt"),ut=o("taskEndAt"),pt=o("workingHours"),mt=o("applyDeadline"),pe=o("postImages"),me=o("postVideos"),j=o("postAttachments"),Rt=o("postAttachmentChips"),h=o("postFormStatus"),St=o("postSubmitBtn"),vt=o("postAssistBot"),Ft=o("postAssistLLM"),ve=o("postAssistTopic"),ge=o("postAssistInstruction"),H=o("postAssistStatus"),it=o("postAssistPreview"),U=o("postAssistRunBtn"),ot=o("postAssistApplyBtn"),gt="",jt="user",L=[],X=[],Pt=!1,N="",S="",P=null,E=null,k=null,V=null,ft=null,Y=null,Z=null,$=[],I=0,yt=[];Et();Tt();function fe(){return new URLSearchParams(window.location.search).get("id")}i(fe,"getPostId");function B(t){return new Date(t).toLocaleString()}i(B,"formatTime");function lt(t){return new Date(t).toISOString()}i(lt,"toISOStringFromLocal");function O(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}i(O,"escapeHtml");function C(t){return`/profile.html?user_id=${encodeURIComponent(t)}`}i(C,"profileUrl");function ye(t){return t&&yt.find(e=>e.id===t)?.name||""}i(ye,"getTagName");async function Nt(){if(!Pt){try{let[t,e]=await Promise.all([Bt(),Ht()]);L=t.response.ok?t.data.bots||[]:[],X=e.response.ok?e.data.configs||[]:[]}catch{L=[],X=[]}Pt=!0,be()}}i(Nt,"loadAssistOptions");function be(){L.length?(vt.innerHTML=L.map(e=>`<option value="${e.id}">${e.name}${e.config_name?` \xB7 ${e.config_name}`:""}</option>`).join(""),U.disabled=!1):(vt.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`,U.disabled=!0);let t=X.map(e=>`<option value="${e.id}">${e.name} \xB7 ${e.model}</option>`).join("");Ft.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${t}`}i(be,"renderPostAssistOptions");function $e(){let t=document.getElementById("postAssistPanel");t?.addEventListener("toggle",()=>{t.open&&Nt()}),U.addEventListener("click",async()=>{let e=Number(vt.value||0);if(e<=0){H.textContent=s("post.assistBotRequired");return}let n=ve.value.trim(),a=rt.value.trim();if(!n&&!a){H.textContent=s("post.assistTopicOrDraftRequired");return}U.disabled=!0,ot.disabled=!0,H.textContent=s("post.assistRunning");try{let l=Number(Ft.value||0),{response:r,data:u}=await It({bot_id:e,llm_config_id:l>0?l:void 0,content:a,topic:n,instruction:ge.value.trim()});if(!r.ok||!u.content){H.textContent=u.error||s("post.assistFailed"),it.hidden=!0,N="";return}N=u.content,it.textContent=N,it.hidden=!1,ot.disabled=!1;let g=u.llm?.model?` \xB7 ${u.llm.model}`:"",p=at(u.usage);H.textContent=`${s("post.assistDone")}${g}${p}`}catch{H.textContent=s("common.networkError")}finally{U.disabled=L.length===0}}),ot.addEventListener("click",()=>{N&&(rt.value=N,H.textContent=s("post.assistApplied"))})}i($e,"setupPostAssistPanel");function ke(t,e){L.length?t.innerHTML=L.map(a=>`<option value="${a.id}">${a.name}${a.config_name?` \xB7 ${a.config_name}`:""}</option>`).join(""):t.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`;let n=X.map(a=>`<option value="${a.id}">${a.name} \xB7 ${a.model}</option>`).join("");e.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${n}`}i(ke,"renderReplyAssistBotOptions");function Le(t,e){let n=document.getElementById("replyAssistPanel");if(!n)return;let a=document.getElementById("replyAssistBot"),l=document.getElementById("replyAssistLLM"),r=document.getElementById("replyAssistInstruction"),u=document.getElementById("replyAssistRunBtn"),g=document.getElementById("replyAssistApplyBtn"),p=document.getElementById("replyAssistStatus"),v=document.getElementById("replyAssistPreview");!a||!l||!r||!u||!g||!p||!v||(n.addEventListener("toggle",async()=>{n.open&&(await Nt(),ke(a,l),u.disabled=L.length===0)}),u.addEventListener("click",async()=>{let w=Number(a.value||0);if(w<=0){p.textContent=s("post.assistBotRequired");return}u.disabled=!0,g.disabled=!0,p.textContent=s("post.assistRunning");try{let T=Number(l.value||0),{response:W,data:_}=await wt(t,{bot_id:w,llm_config_id:T>0?T:void 0,content:e.value.trim(),instruction:r.value.trim()});if(!W.ok||!_.content){p.textContent=_.error||s("post.assistFailed"),v.hidden=!0,S="";return}S=_.content,v.textContent=S,v.hidden=!1,g.disabled=!1;let tt=_.llm?.model?` \xB7 ${_.llm.model}`:"",et=at(_.usage);p.textContent=`${s("post.assistDone")}${tt}${et}`}catch{p.textContent=s("common.networkError")}finally{u.disabled=L.length===0}}),g.addEventListener("click",()=>{S&&(e.value=S,p.textContent=s("post.assistApplied"))}))}i(Le,"setupReplyAssist");async function _e(){let{response:t,data:e}=await At();t.ok&&(yt=e.tags||[],dt.innerHTML=[`<option value="">${s("post.noSection")}</option>`,...yt.map(n=>`<option value="${n.id}">${n.name}</option>`)].join(""))}i(_e,"loadTagOptions");function he(){if(P)return;let t=document.createElement("div");t.className="video-modal",t.innerHTML=`
    <div class="video-modal-backdrop"></div>
    <div class="video-modal-content panel">
      <button class="video-modal-close btn-inline btn-secondary" type="button">${s("common.close")}</button>
      <video class="video-modal-player" controls autoplay preload="metadata"></video>
    </div>
  `,document.body.appendChild(t),P=t,E=b(t,".video-modal-player");let e=i(()=>{P&&(P.classList.remove("open"),E&&(E.pause(),E.removeAttribute("src"),E.load()))},"close");b(t,".video-modal-backdrop").addEventListener("click",e),b(t,".video-modal-close").addEventListener("click",e),document.addEventListener("keydown",n=>{n.key==="Escape"&&e()})}i(he,"ensureVideoModal");function Ee(t){t&&(he(),!(!P||!E)&&(E.src=t,P.classList.add("open"),E.play().catch(()=>{})))}i(Ee,"openVideoModal");function Te(){if(k)return;let t=document.createElement("div");t.className="image-modal",t.innerHTML=`
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
  `,document.body.appendChild(t),k=t,V=b(t,".image-modal-viewer"),ft=b(t,".image-modal-counter"),Y=b(t,".image-modal-prev"),Z=b(t,".image-modal-next");let e=i(()=>{!k||!V||(k.classList.remove("open"),V.removeAttribute("src"),$=[],I=0)},"close");b(t,".image-modal-backdrop").addEventListener("click",e),b(t,".image-modal-close").addEventListener("click",e),Y.addEventListener("click",()=>K(-1)),Z.addEventListener("click",()=>K(1)),document.addEventListener("keydown",n=>{if(k?.classList.contains("open")){if(n.key==="Escape"){e();return}if(n.key==="ArrowLeft"){n.preventDefault(),K(-1);return}n.key==="ArrowRight"&&(n.preventDefault(),K(1))}})}i(Te,"ensureImageModal");function Ot(){if(!k||!V||!ft||!Y||!Z)return;if(!$.length){k.classList.remove("open");return}I=(I+$.length)%$.length,V.src=$[I],ft.textContent=`${I+1} / ${$.length}`;let t=$.length>1;Y.disabled=!t,Z.disabled=!t}i(Ot,"renderImageModal");function Me(t,e){t.length&&(Te(),k&&($=t,I=e,Ot(),k.classList.add("open")))}i(Me,"openImageModal");function K(t){$.length&&(I+=t,Ot())}i(K,"stepImageModal");function Ae(t){return Array.isArray(t.video_items)&&t.video_items.length>0?t.video_items.filter(e=>e&&e.url).map(e=>({url:f(e.url),posterUrl:e.poster_url?f(e.poster_url):""})):(t.videos||[]).map(e=>({url:f(e),posterUrl:""}))}i(Ae,"normalizeVideoItems");function Ct(t,e){return Array.isArray(t.image_items)&&t.image_items.length>0?t.image_items.filter(n=>n&&(n.original_url||n.medium_url||n.small_url)).map(n=>e==="small"?f(n.small_url||n.medium_url||n.original_url):e==="medium"?f(n.medium_url||n.original_url||n.small_url):f(n.original_url||n.medium_url||n.small_url)):(t.images||[]).map(n=>f(n))}i(Ct,"normalizePostImages");function qt(t){t.querySelectorAll(".post-videos video").forEach(e=>{e.addEventListener("click",n=>{n.preventDefault(),n.stopPropagation();let a=e.querySelector("source"),l=e.currentSrc||a?.src||"";e.pause(),Ee(l)})})}i(qt,"enhancePostVideos");function He(t,e){t.querySelectorAll(".post-images img").forEach((n,a)=>{n.addEventListener("click",()=>{Me(e,a)})})}i(He,"enhancePostImages");async function Be(){let t=await fetch(`${m}/api/me`,{credentials:"include"});if(!t.ok){window.location.href="/login.html";return}let e=await t.json();gt=e.user_id,jt=e.role||"user",de.textContent=s("post.welcome",{username:e.username}),ht(e)}i(Be,"loadProfile");async function Ut(t){let e=document.getElementById("replyList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingReplies")}</div>`;let n=await fetch(`${m}/api/posts/${t}/replies?limit=50`,{credentials:"include"});if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.repliesLoadFailed")}</div>`;return}let l=(await n.json()).replies||[];if(l.length===0){e.innerHTML=`<div class='reply-empty'>${s("post.noReplies")}</div>`;return}e.innerHTML=l.map(r=>`
        <div class="reply-item">
          <img class="avatar-xs" src="${F(r.username,r.user_icon,48)}" alt="${r.username}" />
          <div class="reply-body">
            <div class="reply-meta">${r.username} \xB7 ${B(r.created_at)}</div>
            <div class="reply-content">${r.content}</div>
          </div>
        </div>
      `).join("")}i(Ut,"loadReplies");function Ie(t){let e=Ct(t,"medium"),n=Ct(t,"original"),a=e.map(d=>`<img src="${d}" alt="post image" loading="lazy" />`).join(""),l=Ae(t).map(d=>`
        <video controls preload="metadata" ${d.posterUrl?`poster="${d.posterUrl}"`:""}>
          <source src="${d.url}" />
          ${s("post.videoNotSupported")}
        </video>
      `).join(""),r=l?`<div class="post-videos">${l}</div>`:"",u=gt&&t.user_id===gt,g=jt==="admin"||u,p=t.post_type==="task"&&t.task,v=`<a class="post-author-name" href="${C(t.user_id)}">${t.username}</a>`,w=F(t.username,t.user_icon,64),T=p?`
      <div class="task-meta-card">
        <div class="badge">${s("post.gigTaskBadge")}</div>
        <div class="task-meta-grid">
          <div><strong>${s("post.timeRange")}</strong>${B(t.task.start_at)} - ${B(t.task.end_at)}</div>
          <div><strong>${s("post.workingHoursLabel")}</strong>${O(t.task.working_hours)}</div>
          <div><strong>${s("post.applyDeadline")}</strong>${B(t.task.apply_deadline)}</div>
          <div><strong>${s("post.location")}</strong>${O(t.task.location||s("post.noLocation"))}</div>
          <div><strong>${s("post.status")}</strong>${t.task.application_status==="open"?s("post.statusOpen"):s("post.statusClosed")}</div>
          <div><strong>${s("post.applicantCount")}</strong>${t.task.applicant_count||0}</div>
          ${t.task.selected_applicant_name?`<div><strong>${s("post.selectedApplicant")}</strong>${O(t.task.selected_applicant_name)}</div>`:""}
        </div>
      </div>
    `:"",W=ye(t.tag_id),_=W?`<div class="tag-chip">${W}</div>`:"",tt=p?`
      <div class="task-actions">
        ${t.task.can_apply?`<button id="taskApplyBtn" class="btn-inline btn-secondary" type="button">${t.task.applied_by_me?s("post.withdrawApplication"):s("post.applyTask")}</button>`:""}
        ${t.task.can_manage&&t.task.application_status==="open"?`<button id="taskCloseBtn" class="btn-inline btn-secondary" type="button">${s("post.closeApplications")}</button>
               <button id="taskLoadApplicantsBtn" class="btn-inline btn-secondary" type="button">${s("post.viewApplicants")}</button>`:""}
      </div>
      <div id="taskApplicantsPanel" class="task-applicants-panel"></div>
    `:"",et=p&&t.task.can_view_results?`
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
    `:"";D.innerHTML=`
    <div class="post-header">
      <div class="post-author">
        <a href="${C(t.user_id)}"><img class="avatar-sm" src="${w}" alt="${t.username}" /></a>
        ${v}
      </div>
      <div class="post-time">${B(t.created_at)}</div>
    </div>
    <div class="post-content">${t.content}</div>
    ${_}
    ${T}
    <div class="post-images">${a}</div>
    ${r}
    ${we(t.attachments)}
    <div class="post-actions">
      <button id="detailLikeBtn" class="btn-inline btn-secondary" type="button">
        ${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}
      </button>
      ${g?`<button id="detailDeleteBtn" class="btn-inline btn-secondary" type="button">${s("post.deletePost")}</button>`:""}
    </div>
    ${tt}
    ${et}
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
  `;let bt=o("detailLikeBtn"),st=document.getElementById("detailDeleteBtn");qt(D),He(D,n),bt.addEventListener("click",async()=>{let d=t.liked_by_me?"DELETE":"POST";(await fetch(`${m}/api/posts/${t.id}/like`,{method:d,credentials:"include"})).ok&&(t.liked_by_me=!t.liked_by_me,t.like_count+=t.liked_by_me?1:-1,bt.textContent=`${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}`)}),st?.addEventListener("click",async()=>{if(!window.confirm(s("post.confirmDelete")))return;if(st.disabled=!0,!(await fetch(`${m}/api/posts/${t.id}`,{method:"DELETE",credentials:"include"})).ok){st.disabled=!1;return}window.location.href="/posts.html"});let Gt=o("replyForm"),nt=o("replyInput");S="",Le(t.id,nt);let Kt=document.getElementById("taskApplyBtn"),Qt=document.getElementById("taskCloseBtn"),Xt=document.getElementById("taskLoadApplicantsBtn"),M=document.getElementById("taskApplicantsPanel"),$t=document.getElementById("taskResultForm"),Yt=document.getElementById("taskResultNote"),kt=document.getElementById("taskResultImages"),Lt=document.getElementById("taskResultVideos"),J=document.getElementById("taskResultStatus"),G=document.getElementById("taskResultSubmitBtn");Gt.addEventListener("submit",async d=>{d.preventDefault();let y=nt.value.trim();!y||!(await fetch(`${m}/api/posts/${t.id}/replies`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({content:y})})).ok||(nt.value="",await Ut(t.id))}),Kt?.addEventListener("click",async()=>{let d=t.task?.applied_by_me?"DELETE":"POST";(await fetch(`${m}/api/tasks/${t.id}/apply`,{method:d,credentials:"include"})).ok&&await Q()}),Qt?.addEventListener("click",async()=>{(await fetch(`${m}/api/tasks/${t.id}/close`,{method:"POST",credentials:"include"})).ok&&await Q()}),Xt?.addEventListener("click",async()=>{if(!M)return;M.innerHTML=`<div class='reply-empty'>${s("post.loadingApplicants")}</div>`;let d=await fetch(`${m}/api/tasks/${t.id}/applications`,{credentials:"include"});if(!d.ok){M.innerHTML=`<div class='reply-empty'>${s("post.applicantsLoadFailed")}</div>`;return}let x=(await d.json()).applications||[];if(!x.length){M.innerHTML=`<div class='reply-empty'>${s("post.noApplicants")}</div>`;return}M.innerHTML=x.map(c=>{let A=F(c.username,c.user_icon,40),R=t.task?.invitation_template||s("post.invitationDefault",{content:t.content});return`
          <div class="task-applicant-item">
            <div class="task-applicant-head">
              <a href="${C(c.user_id)}"><img class="avatar-xs" src="${A}" alt="${c.username}" /></a>
              <div>
                <div class="reply-meta"><a class="post-author-name" href="${C(c.user_id)}">${c.username}</a> \xB7 ${B(c.applied_at)}</div>
                <div class="task-applicant-id">${c.user_id}</div>
              </div>
            </div>
            <textarea class="input textarea task-template-input" data-user-id="${c.user_id}" rows="4">${O(R)}</textarea>
            <button class="btn-inline btn-secondary task-select-btn" data-user-id="${c.user_id}" type="button">${s("post.confirmAndMessage")}</button>
          </div>
        `}).join(""),M.querySelectorAll(".task-select-btn").forEach(c=>{c.addEventListener("click",async()=>{let A=c.dataset.userId;if(!A)return;let Zt=M.querySelector(`.task-template-input[data-user-id="${A}"]`)?.value.trim()||"";if(c.disabled=!0,!(await fetch(`${m}/api/tasks/${t.id}/select-candidate`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({applicant_user_id:A,message_template:Zt})})).ok){c.disabled=!1;return}await Q()})})}),$t?.addEventListener("submit",async d=>{if(d.preventDefault(),!J||!G||!kt||!Lt)return;let y=new FormData,x=Yt?.value.trim()||"";x&&y.append("note",x),Array.from(kt.files||[]).forEach(R=>y.append("images",R)),Array.from(Lt.files||[]).forEach(R=>y.append("videos",R)),J.textContent=s("post.submittingResult"),G.disabled=!0;let c=await fetch(`${m}/api/tasks/${t.id}/results`,{method:"POST",credentials:"include",body:y}),A=await c.json().catch(()=>({}));if(!c.ok){J.textContent=A.error||s("common.submitFailed"),G.disabled=!1;return}J.textContent=s("post.resultSubmitted"),$t.reset(),G.disabled=!1,await Dt(t.id)}),t.task?.can_view_results&&Dt(t.id)}i(Ie,"renderPost");async function Dt(t){let e=document.getElementById("taskResultList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingResults")}</div>`;let n=await fetch(`${m}/api/tasks/${t}/results`,{credentials:"include"});if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.resultsLoadFailed")}</div>`;return}let l=(await n.json()).results||[];if(!l.length){e.innerHTML=`<div class='reply-empty'>${s("post.noResults")}</div>`;return}e.innerHTML=l.map(r=>{let u=F(r.username,r.user_icon,40),g=(r.images||[]).map(v=>`<img src="${f(v)}" alt="task result image" />`).join(""),p=(r.video_items||[]).map(v=>{let w=f(v.url),T=v.poster_url?f(v.poster_url):"";return`
            <video controls preload="metadata" ${T?`poster="${T}"`:""}>
              <source src="${w}" />
              ${s("post.videoNotSupported")}
            </video>
          `}).join("");return`
        <div class="task-result-item">
          <div class="task-applicant-head">
            <a href="${C(r.user_id)}"><img class="avatar-xs" src="${u}" alt="${r.username}" /></a>
            <div class="reply-meta"><a class="post-author-name" href="${C(r.user_id)}">${r.username}</a> \xB7 ${B(r.created_at)}</div>
          </div>
          ${r.note?`<div class="post-content">${O(r.note)}</div>`:""}
          ${g?`<div class="post-images">${g}</div>`:""}
          ${p?`<div class="post-videos">${p}</div>`:""}
        </div>
      `}).join(""),qt(e)}i(Dt,"loadTaskResults");async function Q(){let t=fe();if(!t){D.innerHTML=`<div class='post-empty'>${s("post.invalidPost")}</div>`;return}let e=await fetch(`${m}/api/posts/${t}`,{credentials:"include"});if(!e.ok){D.innerHTML=`<div class='post-empty'>${s("post.loadFailed")}</div>`;return}let a=(await e.json()).post||null;if(!a){D.innerHTML=`<div class='post-empty'>${s("post.notFound")}</div>`;return}Ie(a),await Ut(a.id)}i(Q,"loadPost");function Vt(){let t=q.value==="task";ce.hidden=!t,ct.required=t,ut.required=t,pt.required=t,mt.required=t}i(Vt,"syncTaskFields");q.addEventListener("change",Vt);var z=[];function zt(){Rt.innerHTML=z.map((t,e)=>`
        <span class="tag-chip" style="display:inline-flex; gap:6px; align-items:center;">
          \u{1F4CE} ${Wt(t.filename)}
          <span style="color:var(--text-muted,#888); font-size:11px;">(${Jt(t.size)})</span>
          <button type="button" data-rm-att="${e}" style="background:none; border:none; color:#c33; cursor:pointer; padding:0; font-size:14px; line-height:1;">\xD7</button>
        </span>`).join(""),Rt.querySelectorAll("[data-rm-att]").forEach(t=>{t.addEventListener("click",()=>{let e=Number(t.getAttribute("data-rm-att"));Number.isFinite(e)&&e>=0&&e<z.length&&(z.splice(e,1),zt())})})}i(zt,"renderAttachmentChips");function Wt(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}i(Wt,"escapeAttachmentName");function we(t){return!t||t.length===0?"":`<ul class="post-attachments" style="list-style:none; padding:0; margin:8px 0 0 0; display:flex; flex-direction:column; gap:6px;">${t.map(n=>`
        <li style="display:flex; gap:8px; align-items:center; padding:6px 8px; background:var(--card,#f7f7f9); border:1px solid var(--border,#ececf0); border-radius:6px;">
          <span style="font-size:14px;">\u{1F4CE}</span>
          <a href="${n.download_url}" download style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${Wt(n.filename)}</a>
          <span style="color:var(--text-muted,#888); font-size:11px;">${Jt(n.size_bytes)}</span>
        </li>`).join("")}</ul>`}i(we,"renderPostAttachmentsList");function Jt(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`}i(Jt,"formatBytes");j.addEventListener("change",async()=>{let t=Array.from(j.files||[]);if(t.length){j.disabled=!0;for(let e of t)try{let n=new FormData;n.append("file",e);let a=await fetch(`${m}/api/attachments`,{method:"POST",credentials:"include",body:n}),l=await a.json();if(!a.ok||!l.attachment){h.textContent=`\u9644\u4EF6 "${e.name}" \u4E0A\u4F20\u5931\u8D25\uFF1A${l.error||"\u670D\u52A1\u5668\u9519\u8BEF"}`;continue}z.push({id:l.attachment.id,filename:l.attachment.filename,size:l.attachment.size_bytes})}catch{h.textContent=`\u9644\u4EF6 "${e.name}" \u4E0A\u4F20\u5931\u8D25`}j.value="",j.disabled=!1,zt()}});xt.addEventListener("submit",async t=>{t.preventDefault();let e=rt.value.trim();if(!e){h.textContent=s("post.contentRequired");return}if(q.value==="task"&&(!ct.value||!ut.value||!pt.value.trim()||!mt.value)){h.textContent=s("post.taskInfoRequired");return}h.textContent=s("post.publishing"),St.disabled=!0;let n=new FormData;n.append("post_type",q.value),dt.value&&n.append("tag_id",dt.value),n.append("content",e),q.value==="task"&&(n.append("task_location",ue.value.trim()),n.append("task_start_at",lt(ct.value)),n.append("task_end_at",lt(ut.value)),n.append("working_hours",pt.value.trim()),n.append("apply_deadline",lt(mt.value))),Array.from(pe.files||[]).forEach(a=>{n.append("images",a)}),Array.from(me.files||[]).forEach(a=>{n.append("videos",a)});for(let a of z)n.append("attachment_ids",a.id);try{let a=await fetch(`${m}/api/posts`,{method:"POST",credentials:"include",body:n}),l=await a.json();if(!a.ok){h.textContent=l.error||s("post.publishFailed");return}h.textContent=s("post.publishSuccess"),xt.reset(),window.location.href=`/post.html?id=${l.id}`}catch{h.textContent=s("post.publishFailedRetry")}finally{St.disabled=!1}});async function xe(){await _t(),await Be(),await _e(),Vt(),$e(),await Q()}i(xe,"init");xe();document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await Mt()}finally{window.location.replace("/login.html")}})});export default Re();
//# sourceMappingURL=post.js.map

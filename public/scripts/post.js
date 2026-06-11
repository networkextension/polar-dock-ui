import{a as Pt,b as $e,c as Ct,d as Ee,e as Dt,f as he}from"./chunk-LGRKWDJD.js";import{a as ot,b as be,c as St,d as Le}from"./chunk-7LDMB7H3.js";import{a as lt,b as _e}from"./chunk-2DO3C5S5.js";import{F as ke,c as Ht,h as Bt,n as It,s as xt,t as Rt}from"./chunk-AZBSN4QF.js";import{b as At,d as ye}from"./chunk-ZOR5O6CM.js";import{a as l,b as k,c as pe}from"./chunk-JKVQ6N26.js";import{b as Tt,c as wt,d as fe}from"./chunk-LM6RPF4Z.js";import"./chunk-ULCIWRC6.js";import{a as f,c as j,d as me,i as s,l as ge,q as _t,r as Mt,t as ve}from"./chunk-LGY4PCW5.js";import{a as i,b as ce,c as ue}from"./chunk-BY6I6UVC.js";function Ft(t){return(t.storage.markdown?.getMarkdown?.()??"").trim()}function jt(t,e={}){let n=new Pt({element:t,extensions:[Ct,Dt.configure({html:!1,tightLists:!0})],content:e.initial||"",editorProps:{attributes:{class:e.cssClass||"rich-prose",spellcheck:"false"}},onUpdate:i(({editor:a})=>{e.onChange?.(Ft(a))},"onUpdate")});return{editor:n,getMarkdown:i(()=>Ft(n),"getMarkdown"),setMarkdown(a){n.commands.setContent(a||"")},clear(){n.commands.clearContent()},isEmpty(){return n.isEmpty},focus(){n.commands.focus("end")},destroy(){n.destroy()}}}var Nt=ce(()=>{$e();Ee();he();i(Ft,"readMarkdown");i(jt,"createMarkdownEditor")});var Xe=ue(()=>{me();be();Le();Nt();_e();pe();ve();fe();ke();ge();ye();var m="",Me=l("postWelcome"),F=l("postDetail"),Ot=l("postForm"),z=l("postContent"),O=l("postType"),ut=l("postTag"),Te=l("taskFields"),we=l("taskLocation"),pt=l("taskStartAt"),mt=l("taskEndAt"),gt=l("workingHours"),vt=l("applyDeadline"),Ae=l("postImages"),He=l("postVideos"),N=l("postAttachments"),qt=l("postAttachmentChips"),h=l("postFormStatus"),Ut=l("postSubmitBtn"),ft=l("postAssistBot"),Kt=l("postAssistLLM"),Be=l("postAssistTopic"),Ie=l("postAssistInstruction"),A=l("postAssistStatus"),rt=l("postAssistPreview"),q=l("postAssistRunBtn"),dt=l("postAssistApplyBtn"),yt="",Gt="user",$=[],Z=[],Vt=!1,S="",P="",C=null,_=null,L=null,U=null,kt=null,tt=null,et=null,b=[],B=0,bt=[];Tt();wt();function xe(){return new URLSearchParams(window.location.search).get("id")}i(xe,"getPostId");function H(t){return new Date(t).toLocaleString()}i(H,"formatTime");function ct(t){return new Date(t).toISOString()}i(ct,"toISOStringFromLocal");function Q(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}i(Q,"escapeHtml");function D(t){return`/profile.html?user_id=${encodeURIComponent(t)}`}i(D,"profileUrl");function Re(t){return t&&bt.find(e=>e.id===t)?.name||""}i(Re,"getTagName");async function Qt(){if(!Vt){try{let[t,e]=await Promise.all([It(),Bt()]);$=t.response.ok?t.data.bots||[]:[],Z=e.response.ok?e.data.configs||[]:[]}catch{$=[],Z=[]}Vt=!0,Se()}}i(Qt,"loadAssistOptions");function Se(){$.length?(ft.innerHTML=$.map(e=>`<option value="${e.id}">${e.name}${e.config_name?` \xB7 ${e.config_name}`:""}</option>`).join(""),q.disabled=!1):(ft.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`,q.disabled=!0);let t=Z.map(e=>`<option value="${e.id}">${e.name} \xB7 ${e.model}</option>`).join("");Kt.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${t}`}i(Se,"renderPostAssistOptions");function Pe(){let t=document.getElementById("postAssistPanel");t?.addEventListener("toggle",()=>{t.open&&Qt()}),q.addEventListener("click",async()=>{let e=Number(ft.value||0);if(e<=0){A.textContent=s("post.assistBotRequired");return}let n=Be.value.trim(),a=z.value.trim();if(!n&&!a){A.textContent=s("post.assistTopicOrDraftRequired");return}q.disabled=!0,dt.disabled=!0,A.textContent=s("post.assistRunning");try{let o=Number(Kt.value||0),{response:r,data:d}=await xt({bot_id:e,llm_config_id:o>0?o:void 0,content:a,topic:n,instruction:Ie.value.trim()});if(!r.ok||!d.content){A.textContent=d.error||s("post.assistFailed"),rt.hidden=!0,S="";return}S=d.content,rt.textContent=S,rt.hidden=!1,dt.disabled=!1;let v=d.llm?.model?` \xB7 ${d.llm.model}`:"",p=lt(d.usage);A.textContent=`${s("post.assistDone")}${v}${p}`}catch{A.textContent=s("common.networkError")}finally{q.disabled=$.length===0}}),dt.addEventListener("click",()=>{S&&(z.value=S,W?.setMarkdown(S),A.textContent=s("post.assistApplied"))})}i(Pe,"setupPostAssistPanel");function Ce(t,e){$.length?t.innerHTML=$.map(a=>`<option value="${a.id}">${a.name}${a.config_name?` \xB7 ${a.config_name}`:""}</option>`).join(""):t.innerHTML=`<option value="">${s("post.assistNoBot")}</option>`;let n=Z.map(a=>`<option value="${a.id}">${a.name} \xB7 ${a.model}</option>`).join("");e.innerHTML=`<option value="">${s("post.assistDefaultLLM")}</option>${n}`}i(Ce,"renderReplyAssistBotOptions");function De(t,e){let n=document.getElementById("replyAssistPanel");if(!n)return;let a=document.getElementById("replyAssistBot"),o=document.getElementById("replyAssistLLM"),r=document.getElementById("replyAssistInstruction"),d=document.getElementById("replyAssistRunBtn"),v=document.getElementById("replyAssistApplyBtn"),p=document.getElementById("replyAssistStatus"),g=document.getElementById("replyAssistPreview");!a||!o||!r||!d||!v||!p||!g||(n.addEventListener("toggle",async()=>{n.open&&(await Qt(),Ce(a,o),d.disabled=$.length===0)}),d.addEventListener("click",async()=>{let I=Number(a.value||0);if(I<=0){p.textContent=s("post.assistBotRequired");return}d.disabled=!0,v.disabled=!0,p.textContent=s("post.assistRunning");try{let M=Number(o.value||0),{response:J,data:E}=await Rt(t,{bot_id:I,llm_config_id:M>0?M:void 0,content:e.value.trim(),instruction:r.value.trim()});if(!J.ok||!E.content){p.textContent=E.error||s("post.assistFailed"),g.hidden=!0,P="";return}P=E.content,g.textContent=P,g.hidden=!1,v.disabled=!1;let st=E.llm?.model?` \xB7 ${E.llm.model}`:"",nt=lt(E.usage);p.textContent=`${s("post.assistDone")}${st}${nt}`}catch{p.textContent=s("common.networkError")}finally{d.disabled=$.length===0}}),v.addEventListener("click",()=>{P&&(e.value=P,p.textContent=s("post.assistApplied"))}))}i(De,"setupReplyAssist");async function Fe(){let{response:t,data:e}=await Ht();t.ok&&(bt=e.tags||[],ut.innerHTML=[`<option value="">${s("post.noSection")}</option>`,...bt.map(n=>`<option value="${n.id}">${n.name}</option>`)].join(""))}i(Fe,"loadTagOptions");function je(){if(C)return;let t=document.createElement("div");t.className="video-modal",t.innerHTML=`
    <div class="video-modal-backdrop"></div>
    <div class="video-modal-content panel">
      <button class="video-modal-close btn-inline btn-secondary" type="button">${s("common.close")}</button>
      <video class="video-modal-player" controls autoplay preload="metadata"></video>
    </div>
  `,document.body.appendChild(t),C=t,_=k(t,".video-modal-player");let e=i(()=>{C&&(C.classList.remove("open"),_&&(_.pause(),_.removeAttribute("src"),_.load()))},"close");k(t,".video-modal-backdrop").addEventListener("click",e),k(t,".video-modal-close").addEventListener("click",e),document.addEventListener("keydown",n=>{n.key==="Escape"&&e()})}i(je,"ensureVideoModal");function Ne(t){t&&(je(),!(!C||!_)&&(_.src=t,C.classList.add("open"),_.play().catch(()=>{})))}i(Ne,"openVideoModal");function Oe(){if(L)return;let t=document.createElement("div");t.className="image-modal",t.innerHTML=`
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
  `,document.body.appendChild(t),L=t,U=k(t,".image-modal-viewer"),kt=k(t,".image-modal-counter"),tt=k(t,".image-modal-prev"),et=k(t,".image-modal-next");let e=i(()=>{!L||!U||(L.classList.remove("open"),U.removeAttribute("src"),b=[],B=0)},"close");k(t,".image-modal-backdrop").addEventListener("click",e),k(t,".image-modal-close").addEventListener("click",e),tt.addEventListener("click",()=>X(-1)),et.addEventListener("click",()=>X(1)),document.addEventListener("keydown",n=>{if(L?.classList.contains("open")){if(n.key==="Escape"){e();return}if(n.key==="ArrowLeft"){n.preventDefault(),X(-1);return}n.key==="ArrowRight"&&(n.preventDefault(),X(1))}})}i(Oe,"ensureImageModal");function Xt(){if(!L||!U||!kt||!tt||!et)return;if(!b.length){L.classList.remove("open");return}B=(B+b.length)%b.length,U.src=b[B],kt.textContent=`${B+1} / ${b.length}`;let t=b.length>1;tt.disabled=!t,et.disabled=!t}i(Xt,"renderImageModal");function qe(t,e){t.length&&(Oe(),L&&(b=t,B=e,Xt(),L.classList.add("open")))}i(qe,"openImageModal");function X(t){b.length&&(B+=t,Xt())}i(X,"stepImageModal");function Ue(t){return Array.isArray(t.video_items)&&t.video_items.length>0?t.video_items.filter(e=>e&&e.url).map(e=>({url:f(e.url),posterUrl:e.poster_url?f(e.poster_url):""})):(t.videos||[]).map(e=>({url:f(e),posterUrl:""}))}i(Ue,"normalizeVideoItems");function zt(t,e){return Array.isArray(t.image_items)&&t.image_items.length>0?t.image_items.filter(n=>n&&(n.original_url||n.medium_url||n.small_url)).map(n=>e==="small"?f(n.small_url||n.medium_url||n.original_url):e==="medium"?f(n.medium_url||n.original_url||n.small_url):f(n.original_url||n.medium_url||n.small_url)):(t.images||[]).map(n=>f(n))}i(zt,"normalizePostImages");function Yt(t){t.querySelectorAll(".post-videos video").forEach(e=>{e.addEventListener("click",n=>{n.preventDefault(),n.stopPropagation();let a=e.querySelector("source"),o=e.currentSrc||a?.src||"";e.pause(),Ne(o)})})}i(Yt,"enhancePostVideos");function Ve(t,e){t.querySelectorAll(".post-images img").forEach((n,a)=>{n.addEventListener("click",()=>{qe(e,a)})})}i(Ve,"enhancePostImages");async function ze(){let t=await fetch(`${m}/api/me`,{credentials:"include"});if(!t.ok){window.location.href="/login.html";return}let e=await t.json();yt=e.user_id,Gt=e.role||"user",Me.textContent=s("post.welcome",{username:e.username}),Mt(e)}i(ze,"loadProfile");async function Zt(t){let e=document.getElementById("replyList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingReplies")}</div>`;let n=await fetch(`${m}/api/posts/${t}/replies?limit=50`,{credentials:"include"});if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.repliesLoadFailed")}</div>`;return}let o=(await n.json()).replies||[];if(o.length===0){e.innerHTML=`<div class='reply-empty'>${s("post.noReplies")}</div>`;return}e.innerHTML=o.map(r=>`
        <div class="reply-item">
          <img class="avatar-xs" src="${j(r.username,r.user_icon,48)}" alt="${r.username}" />
          <div class="reply-body">
            <div class="reply-meta">${r.username} \xB7 ${H(r.created_at)}</div>
            <div class="reply-content">${ot(r.content)}</div>
          </div>
        </div>
      `).join("")}i(Zt,"loadReplies");function We(t){let e=zt(t,"medium"),n=zt(t,"original"),a=e.map(c=>`<img src="${c}" alt="post image" loading="lazy" />`).join(""),o=Ue(t).map(c=>`
        <video controls preload="metadata" ${c.posterUrl?`poster="${c.posterUrl}"`:""}>
          <source src="${c.url}" />
          ${s("post.videoNotSupported")}
        </video>
      `).join(""),r=o?`<div class="post-videos">${o}</div>`:"",d=yt&&t.user_id===yt,v=Gt==="admin"||d,p=t.post_type==="task"&&t.task,g=`<a class="post-author-name" href="${D(t.user_id)}">${t.username}</a>`,I=j(t.username,t.user_icon,64),M=p?`
      <div class="task-meta-card">
        <div class="badge">${s("post.gigTaskBadge")}</div>
        <div class="task-meta-grid">
          <div><strong>${s("post.timeRange")}</strong>${H(t.task.start_at)} - ${H(t.task.end_at)}</div>
          <div><strong>${s("post.workingHoursLabel")}</strong>${Q(t.task.working_hours)}</div>
          <div><strong>${s("post.applyDeadline")}</strong>${H(t.task.apply_deadline)}</div>
          <div><strong>${s("post.location")}</strong>${Q(t.task.location||s("post.noLocation"))}</div>
          <div><strong>${s("post.status")}</strong>${t.task.application_status==="open"?s("post.statusOpen"):s("post.statusClosed")}</div>
          <div><strong>${s("post.applicantCount")}</strong>${t.task.applicant_count||0}</div>
          ${t.task.selected_applicant_name?`<div><strong>${s("post.selectedApplicant")}</strong>${Q(t.task.selected_applicant_name)}</div>`:""}
        </div>
      </div>
    `:"",J=Re(t.tag_id),E=J?`<div class="tag-chip">${J}</div>`:"",st=p?`
      <div class="task-actions">
        ${t.task.can_apply?`<button id="taskApplyBtn" class="btn-inline btn-secondary" type="button">${t.task.applied_by_me?s("post.withdrawApplication"):s("post.applyTask")}</button>`:""}
        ${t.task.can_manage&&t.task.application_status==="open"?`<button id="taskCloseBtn" class="btn-inline btn-secondary" type="button">${s("post.closeApplications")}</button>
               <button id="taskLoadApplicantsBtn" class="btn-inline btn-secondary" type="button">${s("post.viewApplicants")}</button>`:""}
      </div>
      <div id="taskApplicantsPanel" class="task-applicants-panel"></div>
    `:"",nt=p&&t.task.can_view_results?`
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
        <a href="${D(t.user_id)}"><img class="avatar-sm" src="${I}" alt="${t.username}" /></a>
        ${g}
      </div>
      <div class="post-time">${H(t.created_at)}</div>
    </div>
    <div class="post-content md-body">${St(t.content)}</div>
    ${E}
    ${M}
    <div class="post-images">${a}</div>
    ${r}
    ${Je(t.attachments)}
    <div class="post-actions">
      <button id="detailLikeBtn" class="btn-inline btn-secondary" type="button">
        ${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}
      </button>
      ${v?`<button id="detailDeleteBtn" class="btn-inline btn-secondary" type="button">${s("post.deletePost")}</button>`:""}
    </div>
    ${st}
    ${nt}
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
  `;let Lt=l("detailLikeBtn"),at=document.getElementById("detailDeleteBtn");Yt(F),Ve(F,n),Lt.addEventListener("click",async()=>{let c=t.liked_by_me?"DELETE":"POST";(await fetch(`${m}/api/posts/${t.id}/like`,{method:c,credentials:"include"})).ok&&(t.liked_by_me=!t.liked_by_me,t.like_count+=t.liked_by_me?1:-1,Lt.textContent=`${t.liked_by_me?s("post.liked"):s("post.like")} \xB7 ${t.like_count}`)}),at?.addEventListener("click",async()=>{if(!window.confirm(s("post.confirmDelete")))return;if(at.disabled=!0,!(await fetch(`${m}/api/posts/${t.id}`,{method:"DELETE",credentials:"include"})).ok){at.disabled=!1;return}window.location.href="/posts.html"});let ae=l("replyForm"),it=l("replyInput");P="",De(t.id,it);let ie=document.getElementById("taskApplyBtn"),oe=document.getElementById("taskCloseBtn"),le=document.getElementById("taskLoadApplicantsBtn"),T=document.getElementById("taskApplicantsPanel"),$t=document.getElementById("taskResultForm"),re=document.getElementById("taskResultNote"),Et=document.getElementById("taskResultImages"),ht=document.getElementById("taskResultVideos"),K=document.getElementById("taskResultStatus"),G=document.getElementById("taskResultSubmitBtn");ae.addEventListener("submit",async c=>{c.preventDefault();let y=it.value.trim();!y||!(await fetch(`${m}/api/posts/${t.id}/replies`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({content:y})})).ok||(it.value="",await Zt(t.id))}),ie?.addEventListener("click",async()=>{let c=t.task?.applied_by_me?"DELETE":"POST";(await fetch(`${m}/api/tasks/${t.id}/apply`,{method:c,credentials:"include"})).ok&&await Y()}),oe?.addEventListener("click",async()=>{(await fetch(`${m}/api/tasks/${t.id}/close`,{method:"POST",credentials:"include"})).ok&&await Y()}),le?.addEventListener("click",async()=>{if(!T)return;T.innerHTML=`<div class='reply-empty'>${s("post.loadingApplicants")}</div>`;let c=await fetch(`${m}/api/tasks/${t.id}/applications`,{credentials:"include"});if(!c.ok){T.innerHTML=`<div class='reply-empty'>${s("post.applicantsLoadFailed")}</div>`;return}let x=(await c.json()).applications||[];if(!x.length){T.innerHTML=`<div class='reply-empty'>${s("post.noApplicants")}</div>`;return}T.innerHTML=x.map(u=>{let w=j(u.username,u.user_icon,40),R=t.task?.invitation_template||s("post.invitationDefault",{content:t.content});return`
          <div class="task-applicant-item">
            <div class="task-applicant-head">
              <a href="${D(u.user_id)}"><img class="avatar-xs" src="${w}" alt="${u.username}" /></a>
              <div>
                <div class="reply-meta"><a class="post-author-name" href="${D(u.user_id)}">${u.username}</a> \xB7 ${H(u.applied_at)}</div>
                <div class="task-applicant-id">${u.user_id}</div>
              </div>
            </div>
            <textarea class="input textarea task-template-input" data-user-id="${u.user_id}" rows="4">${Q(R)}</textarea>
            <button class="btn-inline btn-secondary task-select-btn" data-user-id="${u.user_id}" type="button">${s("post.confirmAndMessage")}</button>
          </div>
        `}).join(""),T.querySelectorAll(".task-select-btn").forEach(u=>{u.addEventListener("click",async()=>{let w=u.dataset.userId;if(!w)return;let de=T.querySelector(`.task-template-input[data-user-id="${w}"]`)?.value.trim()||"";if(u.disabled=!0,!(await fetch(`${m}/api/tasks/${t.id}/select-candidate`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({applicant_user_id:w,message_template:de})})).ok){u.disabled=!1;return}await Y()})})}),$t?.addEventListener("submit",async c=>{if(c.preventDefault(),!K||!G||!Et||!ht)return;let y=new FormData,x=re?.value.trim()||"";x&&y.append("note",x),Array.from(Et.files||[]).forEach(R=>y.append("images",R)),Array.from(ht.files||[]).forEach(R=>y.append("videos",R)),K.textContent=s("post.submittingResult"),G.disabled=!0;let u=await fetch(`${m}/api/tasks/${t.id}/results`,{method:"POST",credentials:"include",body:y}),w=await u.json().catch(()=>({}));if(!u.ok){K.textContent=w.error||s("common.submitFailed"),G.disabled=!1;return}K.textContent=s("post.resultSubmitted"),$t.reset(),G.disabled=!1,await Wt(t.id)}),t.task?.can_view_results&&Wt(t.id)}i(We,"renderPost");async function Wt(t){let e=document.getElementById("taskResultList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${s("post.loadingResults")}</div>`;let n=await fetch(`${m}/api/tasks/${t}/results`,{credentials:"include"});if(!n.ok){e.innerHTML=`<div class='reply-empty'>${s("post.resultsLoadFailed")}</div>`;return}let o=(await n.json()).results||[];if(!o.length){e.innerHTML=`<div class='reply-empty'>${s("post.noResults")}</div>`;return}e.innerHTML=o.map(r=>{let d=j(r.username,r.user_icon,40),v=(r.images||[]).map(g=>`<img src="${f(g)}" alt="task result image" />`).join(""),p=(r.video_items||[]).map(g=>{let I=f(g.url),M=g.poster_url?f(g.poster_url):"";return`
            <video controls preload="metadata" ${M?`poster="${M}"`:""}>
              <source src="${I}" />
              ${s("post.videoNotSupported")}
            </video>
          `}).join("");return`
        <div class="task-result-item">
          <div class="task-applicant-head">
            <a href="${D(r.user_id)}"><img class="avatar-xs" src="${d}" alt="${r.username}" /></a>
            <div class="reply-meta"><a class="post-author-name" href="${D(r.user_id)}">${r.username}</a> \xB7 ${H(r.created_at)}</div>
          </div>
          ${r.note?`<div class="post-content">${ot(r.note)}</div>`:""}
          ${v?`<div class="post-images">${v}</div>`:""}
          ${p?`<div class="post-videos">${p}</div>`:""}
        </div>
      `}).join(""),Yt(e)}i(Wt,"loadTaskResults");async function Y(){let t=xe();if(!t){F.innerHTML=`<div class='post-empty'>${s("post.invalidPost")}</div>`;return}let e=await fetch(`${m}/api/posts/${t}`,{credentials:"include"});if(!e.ok){F.innerHTML=`<div class='post-empty'>${s("post.loadFailed")}</div>`;return}let a=(await e.json()).post||null;if(!a){F.innerHTML=`<div class='post-empty'>${s("post.notFound")}</div>`;return}We(a),await Zt(a.id)}i(Y,"loadPost");function te(){let t=O.value==="task";Te.hidden=!t,pt.required=t,mt.required=t,gt.required=t,vt.required=t}i(te,"syncTaskFields");O.addEventListener("change",te);var V=[];function ee(){qt.innerHTML=V.map((t,e)=>`
        <span class="tag-chip" style="display:inline-flex; gap:6px; align-items:center;">
          \u{1F4CE} ${se(t.filename)}
          <span style="color:var(--text-muted,#888); font-size:11px;">(${ne(t.size)})</span>
          <button type="button" data-rm-att="${e}" style="background:none; border:none; color:#c33; cursor:pointer; padding:0; font-size:14px; line-height:1;">\xD7</button>
        </span>`).join(""),qt.querySelectorAll("[data-rm-att]").forEach(t=>{t.addEventListener("click",()=>{let e=Number(t.getAttribute("data-rm-att"));Number.isFinite(e)&&e>=0&&e<V.length&&(V.splice(e,1),ee())})})}i(ee,"renderAttachmentChips");function se(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}i(se,"escapeAttachmentName");function Je(t){return!t||t.length===0?"":`<ul class="post-attachments" style="list-style:none; padding:0; margin:8px 0 0 0; display:flex; flex-direction:column; gap:6px;">${t.map(n=>`
        <li style="display:flex; gap:8px; align-items:center; padding:6px 8px; background:var(--card,#f7f7f9); border:1px solid var(--border,#ececf0); border-radius:6px;">
          <span style="font-size:14px;">\u{1F4CE}</span>
          <a href="${n.download_url}" download style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${se(n.filename)}</a>
          <span style="color:var(--text-muted,#888); font-size:11px;">${ne(n.size_bytes)}</span>
        </li>`).join("")}</ul>`}i(Je,"renderPostAttachmentsList");function ne(t){return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`}i(ne,"formatBytes");N.addEventListener("change",async()=>{let t=Array.from(N.files||[]);if(t.length){N.disabled=!0;for(let e of t)try{let n=new FormData;n.append("file",e);let a=await fetch(`${m}/api/attachments`,{method:"POST",credentials:"include",body:n}),o=await a.json();if(!a.ok||!o.attachment){h.textContent=`\u9644\u4EF6 "${e.name}" \u4E0A\u4F20\u5931\u8D25\uFF1A${o.error||"\u670D\u52A1\u5668\u9519\u8BEF"}`;continue}V.push({id:o.attachment.id,filename:o.attachment.filename,size:o.attachment.size_bytes})}catch{h.textContent=`\u9644\u4EF6 "${e.name}" \u4E0A\u4F20\u5931\u8D25`}N.value="",N.disabled=!1,ee()}});var Jt=l("postEditor"),Ke=l("postEditorToolbar"),W=null;Jt&&(W=jt(Jt,{cssClass:"rich-prose",onChange:i(t=>{z.value=t},"onChange")}),Ge(Ke,W));function Ge(t,e){t&&t.addEventListener("click",n=>{let a=n.target.closest("[data-cmd]");if(!a)return;n.preventDefault();let o=e.editor.chain().focus();switch(a.dataset.cmd){case"bold":o.toggleBold().run();break;case"italic":o.toggleItalic().run();break;case"strike":o.toggleStrike().run();break;case"h2":o.toggleHeading({level:2}).run();break;case"bulletList":o.toggleBulletList().run();break;case"orderedList":o.toggleOrderedList().run();break;case"blockquote":o.toggleBlockquote().run();break;case"code":o.toggleCode().run();break;case"codeBlock":o.toggleCodeBlock().run();break;case"link":{let r=e.editor.getAttributes("link").href,d=window.prompt("Link URL",r||"https://");if(d===null){o.run();return}if(d.trim()===""){o.extendMarkRange("link").unsetLink().run();return}o.extendMarkRange("link").setLink({href:d.trim()}).run();break}default:o.run()}})}i(Ge,"wireRichToolbar");Ot.addEventListener("submit",async t=>{t.preventDefault(),W&&(z.value=W.getMarkdown());let e=z.value.trim();if(!e){h.textContent=s("post.contentRequired");return}if(O.value==="task"&&(!pt.value||!mt.value||!gt.value.trim()||!vt.value)){h.textContent=s("post.taskInfoRequired");return}h.textContent=s("post.publishing"),Ut.disabled=!0;let n=new FormData;n.append("post_type",O.value),ut.value&&n.append("tag_id",ut.value),n.append("content",e),O.value==="task"&&(n.append("task_location",we.value.trim()),n.append("task_start_at",ct(pt.value)),n.append("task_end_at",ct(mt.value)),n.append("working_hours",gt.value.trim()),n.append("apply_deadline",ct(vt.value))),Array.from(Ae.files||[]).forEach(a=>{n.append("images",a)}),Array.from(He.files||[]).forEach(a=>{n.append("videos",a)});for(let a of V)n.append("attachment_ids",a.id);try{let a=await fetch(`${m}/api/posts`,{method:"POST",credentials:"include",body:n}),o=await a.json();if(!a.ok){h.textContent=o.error||s("post.publishFailed");return}h.textContent=s("post.publishSuccess"),Ot.reset(),window.location.href=`/post.html?id=${o.id}`}catch{h.textContent=s("post.publishFailedRetry")}finally{Ut.disabled=!1}});async function Qe(){await _t(),await ze(),await Fe(),te(),Pe(),await Y()}i(Qe,"init");Qe();document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await At()}finally{window.location.replace("/login.html")}})});export default Xe();
//# sourceMappingURL=post.js.map

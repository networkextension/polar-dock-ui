import{C as j,H as ge}from"./chunk-4YLQVBOU.js";import{a as C,b as N,c as q,d as ve}from"./chunk-ZOR5O6CM.js";import{a as d,c as ue}from"./chunk-JKVQ6N26.js";import{b as O,c as V,d as be}from"./chunk-LM6RPF4Z.js";import{c as v,d as de}from"./chunk-ULCIWRC6.js";import{c as L,d as fe,i as t,l as me,q as A,r as D,t as pe}from"./chunk-DSN4KU5G.js";import{a as l,b as ae,c as ce}from"./chunk-BY6I6UVC.js";async function W(e){return v(`/api/users/${encodeURIComponent(e)}/profile`)}async function Y(e,o){let i={bio:e};return o!==void 0&&(i.industry=o),v("/api/users/me/profile",{method:"PUT",body:i})}async function J(e,o){return v(`/api/users/${encodeURIComponent(e)}/recommendations`,{method:"POST",body:{content:o}})}async function K(e){return v(`/api/users/${encodeURIComponent(e)}/block`,{method:"POST"})}async function z(e){return v(`/api/users/${encodeURIComponent(e)}/block`,{method:"DELETE"})}async function G(e){return v(`/api/users/${encodeURIComponent(e)}/follow`,{method:"POST"})}async function Q(e){return v(`/api/users/${encodeURIComponent(e)}/follow`,{method:"DELETE"})}async function X(e,o=20,i=0){let r=new URLSearchParams({limit:String(o),offset:String(i)});return v(`/api/users/${encodeURIComponent(e)}/followers?${r.toString()}`)}async function Z(e,o=20,i=0){let r=new URLSearchParams({limit:String(o),offset:String(i)});return v(`/api/users/${encodeURIComponent(e)}/following?${r.toString()}`)}var ee=ae(()=>{de();l(W,"fetchUserProfile");l(Y,"updateMyProfile");l(J,"upsertRecommendation");l(K,"blockUser");l(z,"unblockUser");l(G,"followUser");l(Q,"unfollowUser");l(X,"fetchFollowers");l(Z,"fetchFollowing")});var Be=ce(()=>{ee();ge();ve();fe();ue();pe();be();me();var _=d("profileWelcome"),ye=d("profileCard"),te=d("profileBioPanel"),oe=d("profileFollowPanel"),we=d("profileRecommendationPanel"),ie="",B="",I=!1,_e="",$="followers",S=null;O();V();function $e(){return new URLSearchParams(window.location.search).get("user_id")}l($e,"getUserId");function re(e){return new Date(e).toLocaleString()}l(re,"formatTime");function b(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}l(b,"escapeHtml");async function Ee(){let{response:e,data:o}=await C();if(!e.ok){window.location.href="/login.html";return}ie=o.user_id,B=o.email||"",I=!!o.email_verified,D(o)}l(Ee,"loadCurrentUser");function M(e){let o=L(e.username,e.icon_url,120),i=e.is_me&&e.email?`<div class="profile-meta-line profile-email-line"><span class="profile-meta-label">${t("profile.email")}</span><a class="profile-email-link" href="mailto:${b(e.email)}">${b(e.email)}</a></div>`:"",r=!e.is_me&&!e.i_blocked_user&&!e.blocked_me,c=e.i_blocked_user?t("profile.youBlockedUser"):e.blocked_me?t("profile.userBlockedYou"):"",f=r?`<a class="btn-inline btn-secondary" href="/chat.html?user_id=${encodeURIComponent(e.user_id)}&username=${encodeURIComponent(e.username)}">${t("profile.sendMessage")}</a>`:"",n=!e.is_me&&!e.i_blocked_user&&!e.blocked_me?`<button id="profileFollowBtn" class="btn-inline ${e.is_following?"btn-secondary":"btn-primary"}" type="button">${e.is_following?t("profile.unfollowUser"):t("profile.followUser")}</button>`:"",a=e.is_me?"":`<button id="profileBlockBtn" class="btn-inline btn-secondary" type="button">${e.i_blocked_user?t("profile.unblockUser"):t("profile.blockUser")}</button>`,p=e.follower_count??0,g=e.following_count??0,E=`
    <div class="profile-meta-line profile-follow-summary">
      <span class="profile-follow-count"><strong>${p}</strong> ${t("profile.followersLabel")}</span>
      <span class="profile-follow-count"><strong>${g}</strong> ${t("profile.followingLabel")}</span>
      ${e.followed_me?`<span class="tag-chip">${t("profile.followsYou")}</span>`:""}
    </div>
  `,y=c?`<div class="status-text">${b(c)}</div>`:"";if(ye.innerHTML=`
    <div class="profile-hero">
      <img class="profile-hero-avatar" src="${o}" alt="${e.username}" />
      <div class="profile-hero-body">
        <div class="badge">${e.is_me?t("profile.myProfile"):t("profile.userProfile")}</div>
        <h2>${e.username}</h2>
        ${i}
        <div class="profile-meta-line">${t("profile.userId",{id:e.user_id})}</div>
        <div class="profile-meta-line">${t("profile.joinedAt",{time:re(e.created_at)})}</div>
        ${E}
        <div class="task-form-actions">${f}${n}${a}</div>
        ${y}
      </div>
    </div>
  `,e.is_me)return;let h=document.getElementById("profileFollowBtn");h?.addEventListener("click",async()=>{h.disabled=!0;let u=e.is_following?await Q(e.user_id):await G(e.user_id);if(!u.response.ok||!u.data.profile){_.textContent=u.data.error||t("profile.followActionFailed"),h.disabled=!1;return}_.textContent=u.data.message||"";let m=u.data.profile;M(m),H(m),U(m),F(m)});let x=d("profileBlockBtn");x.addEventListener("click",async()=>{x.disabled=!0;let u=e.i_blocked_user?await z(e.user_id):await K(e.user_id);if(!u.response.ok||!u.data.profile){_.textContent=u.data.error||t("profile.blockActionFailed"),x.disabled=!1;return}_.textContent=u.data.message||"";let m=u.data.profile;M(m),H(m),U(m),F(m)})}l(M,"renderProfileCard");function he(e){return e.length?e.map(o=>{let i=L(o.username,o.user_icon,40),r=o.bio?`<div class="reply-meta">${b(o.bio)}</div>`:"",c=o.is_following?`<span class="tag-chip">${t("profile.followingLabel")}</span>`:"";return`
        <div class="profile-recommendation-item">
          <div class="task-applicant-head">
            <a href="/profile.html?user_id=${encodeURIComponent(o.id)}">
              <img class="avatar-xs" src="${i}" alt="${b(o.username)}" />
            </a>
            <div>
              <a class="post-author-name" href="/profile.html?user_id=${encodeURIComponent(o.id)}">${b(o.username)}</a>
              ${r}
            </div>
            ${c}
          </div>
        </div>
      `}).join(""):`<div class='reply-empty'>${t($==="followers"?"profile.noFollowers":"profile.noFollowing")}</div>`}l(he,"renderFollowUserList");async function ne(){if(!S)return;let e=document.getElementById("profileFollowList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${t("profile.loadingFollowList")}</div>`;let o=S.user_id,i=$==="followers"?X:Z,{response:r,data:c}=await i(o,30,0);if(!r.ok){e.innerHTML=`<div class='reply-empty'>${t("profile.followListLoadFailed")}</div>`;return}e.innerHTML=he(c.users||[])}l(ne,"loadFollowList");function U(e){S=e;let o=e.follower_count??0,i=e.following_count??0;oe.innerHTML=`
    <div class="badge">${t("profile.followSection")}</div>
    <div class="lp-filter-bar" style="margin-top:8px;">
      <button class="btn-inline btn-secondary profile-follow-tab ${$==="followers"?"active":""}" data-follow-tab="followers" type="button">${t("profile.tabFollowers",{count:String(o)})}</button>
      <button class="btn-inline btn-secondary profile-follow-tab ${$==="following"?"active":""}" data-follow-tab="following" type="button">${t("profile.tabFollowing",{count:String(i)})}</button>
    </div>
    <div id="profileFollowList" class="task-result-list" style="margin-top:8px;"></div>
  `,oe.querySelectorAll(".profile-follow-tab").forEach(r=>{r.addEventListener("click",async()=>{let c=r.dataset.followTab||"followers";c!==$&&($=c,U(e),await ne())})}),ne()}l(U,"renderFollowPanel");function H(e){if(e.is_me){let o=I?t("profile.emailVerified"):t("profile.emailUnverified"),i=I?"":`<button id="profileSendVerificationBtn" class="btn-inline btn-secondary" type="button">${t("profile.sendVerificationEmail")}</button>`;te.innerHTML=`
      <div class="badge">${t("profile.bio")}</div>
      <div class="profile-verification-card">
        <div class="profile-meta-line"><span class="profile-meta-label">${t("profile.email")}</span><span>${b(B||t("profile.emailUnavailable"))}</span></div>
        <div class="profile-meta-line"><span class="profile-meta-label">${t("profile.emailVerificationStatus")}</span><span>${o}</span></div>
        <div id="profileEmailVerificationStatus" class="status-text"></div>
        <div class="task-form-actions">
          ${i}
        </div>
      </div>
      <form id="profileBioForm" class="task-result-form">
        <label class="form-label" for="profileBioInput">${t("profile.personalBio")}</label>
        <textarea id="profileBioInput" class="input textarea" rows="5" maxlength="500" placeholder="${t("profile.bioPlaceholder")}">${b(e.bio||"")}</textarea>
        <label class="form-label" for="profileIndustryInput">\u884C\u4E1A / \u9886\u57DF <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">\uFF08\u53EF\u9009 \u2014 \u7528\u4E8E AI \u4EFB\u52A1\u4F18\u5316\u65F6\u6CE8\u5165\u9886\u57DF\u4E0A\u4E0B\u6587\uFF09</span></label>
        <input id="profileIndustryInput" class="input" type="text" maxlength="80" list="profileIndustryOptions" value="${b(e.industry||"")}" placeholder="\u4F8B\u5982\uFF1AiOS \u5E94\u7528\u5F00\u53D1\u3001\u91CF\u5316\u91D1\u878D\u3001\u4E34\u5E8A\u7814\u7A76\u3001\u6559\u80B2\u79D1\u6280" />
        <datalist id="profileIndustryOptions">
          <option value="iOS \u5E94\u7528\u5F00\u53D1"></option>
          <option value="Web \u5168\u6808\u5F00\u53D1"></option>
          <option value="\u91CF\u5316\u91D1\u878D"></option>
          <option value="\u533B\u7597 / \u4E34\u5E8A\u7814\u7A76"></option>
          <option value="\u6CD5\u5F8B / \u5408\u89C4"></option>
          <option value="\u79D1\u7814 / \u6570\u636E\u5206\u6790"></option>
          <option value="\u589E\u957F / \u8425\u9500\u8FD0\u8425"></option>
          <option value="\u6559\u80B2\u79D1\u6280"></option>
        </datalist>
        <label class="form-label" for="profileIconInput">${t("profile.avatar")}</label>
        <input id="profileIconInput" class="input" type="file" accept="image/*" />
        <div id="profileBioStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">${t("profile.saveProfile")}</button>
          <button id="profileBioRefineBtn" class="btn-inline btn-secondary" type="button" title="\u7528 AI \u5E2E\u6211\u6539\u5199">\u2728 AI \u6539\u5199</button>
        </div>
      </form>
    `;let r=d("profileBioForm"),c=d("profileBioInput"),f=d("profileIconInput"),s=d("profileBioStatus"),n=d("profileEmailVerificationStatus"),a=document.getElementById("profileSendVerificationBtn");document.getElementById("profileBioRefineBtn")?.addEventListener("click",()=>{Le(c)}),a?.addEventListener("click",async()=>{a.disabled=!0,n.textContent=t("profile.sendingVerificationEmail");let{response:g,data:E}=await q();if(!g.ok){n.textContent=E.error||t("profile.emailVerificationSendFailed"),n.classList.remove("status-success"),n.classList.add("status-error"),a.disabled=!1;return}let y=await C();y.response.ok&&(B=y.data.email||B,I=!!y.data.email_verified),n.textContent=E.message||t("profile.verificationEmailSent"),n.classList.remove("status-error"),n.classList.add("status-success"),await R()}),r.addEventListener("submit",async g=>{g.preventDefault(),s.textContent=t("profile.saving");let y=document.getElementById("profileIndustryInput")?.value.trim()??void 0,{response:h,data:x}=await Y(c.value.trim(),y);if(!h.ok){s.textContent=x.error||t("profile.saveFailed");return}let u=f.files?.[0];if(u){let m=new FormData;m.append("icon",u);let{response:le,data:se}=await j(m);if(!le.ok){s.textContent=se.error||t("profile.avatarUploadFailed");return}}s.textContent=t("profile.profileUpdated"),await R()});return}te.innerHTML=`
    <div class="badge">${t("profile.bio")}</div>
    <div class="profile-bio-copy">${e.bio?b(e.bio):t("profile.noBio")}</div>
  `}l(H,"renderBioPanel");function F(e){let o=e.recommendations||[],i=e.can_recommend&&!e.i_blocked_user&&!e.blocked_me?`
      <form id="recommendationForm" class="task-result-form">
        <label class="form-label" for="recommendationInput">${t("profile.writeRecommendation")}</label>
        <textarea id="recommendationInput" class="input textarea" rows="4" maxlength="1000" placeholder="${t("profile.recommendationPlaceholder")}"></textarea>
        <div id="recommendationStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">${t("profile.submitRecommendation")}</button>
        </div>
      </form>
    `:"",r=o.length?o.map(n=>{let a=L(n.author_username,n.author_user_icon,40);return`
            <div class="profile-recommendation-item">
              <div class="task-applicant-head">
                <a href="/profile.html?user_id=${encodeURIComponent(n.author_user_id)}">
                  <img class="avatar-xs" src="${a}" alt="${n.author_username}" />
                </a>
                <div>
                  <a class="post-author-name" href="/profile.html?user_id=${encodeURIComponent(n.author_user_id)}">${n.author_username}</a>
                  <div class="reply-meta">${re(n.updated_at)}</div>
                </div>
              </div>
              <div class="profile-bio-copy">${b(n.content)}</div>
            </div>
          `}).join(""):`<div class='reply-empty'>${t("profile.noRecommendations")}</div>`;if(we.innerHTML=`
    <div class="badge">${t("profile.recommendation")}</div>
    ${e.i_blocked_user||e.blocked_me?`<div class="status-text">${e.i_blocked_user?t("profile.recommendationBlockedByYou"):t("profile.recommendationBlockedByOther")}</div>`:""}
    ${i}
    <div class="task-result-list">${r}</div>
  `,!e.can_recommend||e.i_blocked_user||e.blocked_me)return;let c=d("recommendationForm"),f=d("recommendationInput"),s=d("recommendationStatus");c.addEventListener("submit",async n=>{n.preventDefault();let a=f.value.trim();if(!a){s.textContent=t("profile.recommendationRequired");return}s.textContent=t("profile.submitting");let{response:p,data:g}=await J(e.user_id,a);if(!p.ok){s.textContent=g.error||t("profile.submitFailed");return}s.textContent=t("profile.recommendationSaved"),f.value="",await R()})}l(F,"renderRecommendationPanel");async function R(){let e=$e()||ie;_e=e;let{response:o,data:i}=await W(e);if(!o.ok||!i.profile){_.textContent=i.error||t("profile.loadFailed");return}let r=i.profile;_.textContent=r.is_me?t("profile.completeProfile"):t("profile.viewingProfile",{username:r.username}),M(r),H(r),U(r),F(r)}l(R,"loadProfile");async function xe(){await A(),await Ee(),await R()}l(xe,"init");xe();document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await N()}finally{window.location.replace("/login.html")}});var ke=[{key:"more_professional",label:"\u66F4\u4E13\u4E1A"},{key:"more_concise",label:"\u66F4\u7B80\u77ED"},{key:"more_structured",label:"\u66F4\u7ED3\u6784\u5316"},{key:"add_industry_keywords",label:"\u52A0\u4E0A\u884C\u4E1A\u5173\u952E\u8BCD"},{key:"warmer",label:"\u66F4\u4EB2\u5207\u53E3\u8BED"}],w=null,k=new Set;function T(e){let o=document.getElementById("bioRefineModal");o&&(o.classList.toggle("open",e),o.setAttribute("aria-hidden",e?"false":"true"))}l(T,"setBioRefineModalOpen");function Le(e){w=e,k.clear();let o=document.getElementById("bioRefineHints");o&&(o.innerHTML=ke.map(n=>`<button type="button" class="btn-chip" data-hint="${n.key}">${n.label}</button>`).join(""),o.querySelectorAll("[data-hint]").forEach(n=>{n.addEventListener("click",()=>{let a=n.dataset.hint;k.has(a)?(k.delete(a),n.classList.remove("is-active")):(k.add(a),n.classList.add("is-active"))})}));let i=document.getElementById("bioRefineCurrent");i&&(i.textContent=e.value.trim()||"\uFF08\u7A7A \u2014 \u7CFB\u7EDF\u4F1A\u5EFA\u8BAE\u5148\u5199\u4E2A\u521D\u7A3F\uFF09");let r=document.getElementById("bioRefineExtra");r&&(r.value="");let c=document.getElementById("bioRefineResults");c&&(c.innerHTML="");let f=document.getElementById("bioRefineNotes");f&&(f.textContent="");let s=document.getElementById("bioRefineStatus");s&&(s.textContent=""),T(!0)}l(Le,"openBioRefineModal");document.getElementById("bioRefineCloseBtn")?.addEventListener("click",()=>{T(!1)});document.querySelector("#bioRefineModal .modal-backdrop")?.addEventListener("click",()=>T(!1));document.getElementById("bioRefineRunBtn")?.addEventListener("click",async()=>{if(!w)return;let e=document.getElementById("bioRefineRunBtn"),o=document.getElementById("bioRefineStatus"),i=document.getElementById("bioRefineResults"),r=document.getElementById("bioRefineNotes");e&&(e.disabled=!0),o&&(o.textContent="\u751F\u6210\u4E2D..."),i&&(i.innerHTML=""),r&&(r.textContent="");try{let c=document.getElementById("bioRefineExtra"),f=await fetch("/api/system-agent/bio/refine",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({current_bio:w.value,hints:Array.from(k),extra:c?.value??""})}),s=await f.json();if(!f.ok){o&&(o.textContent=s?.error||"\u751F\u6210\u5931\u8D25");return}o&&s.llm?o.textContent=`\u7531 ${s.llm.name}${s.llm.model?` \xB7 ${s.llm.model}`:""} \u751F\u6210`:o&&(o.textContent="");let n=s.drafts||[];i&&(i.innerHTML=n.map((a,p)=>`
            <div class="bio-refine-draft">
              <div class="bio-refine-draft-head">
                <span class="bio-refine-draft-label">${P(a.label||`\u5019\u9009 ${p+1}`)}</span>
                <button type="button" class="btn-inline btn-secondary" data-adopt="${p}">\u91C7\u7528</button>
              </div>
              <div class="bio-refine-draft-text">${P(a.text)}</div>
              ${a.rationale?`<div class="bio-refine-draft-rationale">\u8C03\u6574\uFF1A${P(a.rationale)}</div>`:""}
            </div>
          `).join(""),i.querySelectorAll("[data-adopt]").forEach(a=>{a.addEventListener("click",()=>{let p=Number(a.dataset.adopt);Number.isNaN(p)||!n[p]||!w||(w.value=n[p].text,w.dispatchEvent(new Event("input",{bubbles:!0})),T(!1))})})),r&&s.notes&&(r.textContent=s.notes)}catch(c){o&&(o.textContent=`\u751F\u6210\u5931\u8D25\uFF1A${c.message}`)}finally{e&&(e.disabled=!1)}});function P(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}l(P,"escapeHtmlBio")});export default Be();
//# sourceMappingURL=profile.js.map

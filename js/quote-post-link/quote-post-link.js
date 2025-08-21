document.querySelectorAll('.quote-box>cite').forEach((cite) => {
  const text = cite.textContent;
  const match = text.match(/^(#p\d+),(.*)$/s);
  if (!match) return;
  const postId = match[1].trim();
  const label = match[2].trim();
  let href = '';
  if (document.querySelector(`.post${postId}`)) {
    href = `<a class="qc-post-link" href="${postId}">${label}</a>`;
  } else {
    const pidNum = postId.slice(2);
    href = `<a class="qc-post-link" href="/viewtopic.php?pid=${pidNum}${postId}">${label}</a>`;
  }
  cite.innerHTML = href;
});

document.querySelectorAll('#pun-viewtopic .pl-quote > a').forEach((a) => {
  const post = a.closest('.post');
  if (!post) return;
  const postId = post.id;
  a.href = a.href.replace("('", `('#${postId},`);
});

(function () {
  const ANGLE_QUOTE_REGEX = /"([^"]*?)"/g;

  document.addEventListener('DOMContentLoaded', () => {
    const paragraphNodes = document.querySelectorAll('.post-content p');

    paragraphNodes.forEach((paragraphNode, paragraphIndex) => {
      const textWalker = document.createTreeWalker(
        paragraphNode,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );

      let textNode;
      while ((textNode = textWalker.nextNode())) {
        const originalText = textNode.nodeValue;
        const newText = originalText.replace(ANGLE_QUOTE_REGEX, '«$1»');
        if (newText !== originalText) {
          textNode.nodeValue = newText;
        }
      }
    });
  });
})();

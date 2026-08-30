export function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }
  return element as T;
}

export function query<T extends Element>(
  root: ParentNode,
  selector: string
): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element as T;
}

/**
 * 可选查找：元素不存在时返回 null，不抛异常。
 *
 * 用于一个脚本服务多个页面、各页面只包含部分区块的场景
 * （如 llm-billing.ts 同时被 llm.html / llm-billing.html / llm-apps.html 加载）。
 * 与 byId 的区别：byId 表达“这个元素必须存在，否则是 bug”。
 */
export function byIdOpt<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

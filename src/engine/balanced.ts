import { numbers, recorder } from "./model";
import type { Node, Edge, Trace, Frame } from "./model";
export type Tree = {
  value: number;
  height: number;
  red?: boolean;
  left?: Tree;
  right?: Tree;
};
export function balanced(id: string, raw: string): Trace {
  const values =
    raw === "0"
      ? [30, 20, 10, 25, 40, 50, 5]
      : raw === "1"
        ? [30, 10, 20, 40, 50, 25]
        : numbers(raw);
  const avl = id === "avl",
    order = [...new Set(values)].sort((a, b) => a - b);
  const { frames, add } = recorder();
  let root: Tree | undefined,
    cursor = -1;
  const h = (p?: Tree): number => p?.height || 0;
  const update = (p: Tree) => {
    p.height = 1 + Math.max(h(p.left), h(p.right));
  };
  const refresh = (p?: Tree): void => {
    if (p) {
      refresh(p.left);
      refresh(p.right);
      update(p);
    }
  };
  const picture = () => {
    refresh(root);
    const nodes: Node[] = [],
      edges: Edge[] = [];
    const visit = (p: Tree | undefined, d: number, parent?: Tree) => {
      if (!p) return;
      nodes.push({
        id: String(p.value),
        label: String(p.value),
        x: 65 + (order.indexOf(p.value) * 550) / Math.max(1, order.length - 1),
        y: 45 + d * 88,
        color: avl
          ? Math.abs(h(p.left) - h(p.right)) > 1
            ? "orange"
            : undefined
          : p.red
            ? "orange"
            : undefined,
        subtitle: avl
          ? `h=${h(p)} · BF=${h(p.left) - h(p.right)}`
          : p.red
            ? "红节点"
            : "黑节点",
      });
      if (parent)
        edges.push({
          from: String(parent.value),
          to: String(p.value),
          active: !avl && !!p.red,
        });
      visit(p.left, d + 1, p);
      visit(p.right, d + 1, p);
    };
    visit(root, 0);
    return { nodes, edges };
  };
  const snap = (
    title: string,
    detail: string,
    why: string,
    check: string,
    checkpoint = true,
    done = false,
  ) => {
    add(title, detail, {
      ...picture(),
      result: root,
      checkpoint,
      inputState: {
        source: values.map(String),
        current: cursor >= 0 && !done ? String(values[cursor]) : undefined,
        pending: values.slice(cursor + 1).map(String),
        processed: Math.max(0, cursor + (done ? 1 : 0)),
        label: "按顺序插入；重复键忽略",
      },
      explanation: {
        why,
        changes: detail,
        check,
        predict: done
          ? "观察下一个输入会落在哪条搜索路径。"
          : "旋转能否保持所有键的中序顺序不变？",
      },
    });
  };
  const rotate = (p: Tree, dir: "left" | "right") => {
    const q = dir === "left" ? p.right! : p.left!;
    if (dir === "left") {
      p.right = q.left;
      q.left = p;
    } else {
      p.left = q.right;
      q.right = p;
    }
    if (!avl) {
      q.red = p.red;
      p.red = true;
    }
    update(p);
    update(q);
    return q;
  };
  type Attach = (p: Tree) => void;
  const insert = (p: Tree | undefined, v: number, attach: Attach): Tree => {
    if (!p) {
      const node = { value: v, height: 1, red: !avl };
      attach(node);
      snap(
        "连接新叶子",
        `${v} 已接入完整树，开始沿搜索路径向上检查。`,
        "搜索树左小右大决定落点；新叶子可能让祖先失衡。",
        "此时允许暂时失衡；修复完成后才检查全部平衡性质。",
        false,
      );
      return node;
    }
    if (v === p.value) {
      snap(
        "忽略重复键",
        `${v} 已存在，结构不变。`,
        "本课模拟集合，不存重复键。",
        "节点数不增加。",
        false,
      );
      return p;
    }
    if (v < p.value)
      insert(p.left, v, (q) => {
        p!.left = q;
      });
    else
      insert(p.right, v, (q) => {
        p!.right = q;
      });
    update(p);
    const turn = (dir: "left" | "right", title: string, why: string) => {
      const old = p!.value,
        child = (dir === "left" ? p!.right : p!.left)!.value;
      snap(
        "旋转前：" + title,
        `枢轴 ${old}，将提升 ${child}。`,
        why,
        "比较旋转前后的中序序列，键不能丢失或换序。",
      );
      p = rotate(p!, dir);
      attach(p);
      snap(
        title,
        `${child} 成为这棵子树的根，${old} 下移；中间子树重新接回。`,
        why,
        "全树仍可见，原来的祖先已连接到新的子树根。",
      );
    };
    if (avl) {
      const b = h(p.left) - h(p.right);
      if (b > 1) {
        if (h(p.left!.left) < h(p.left!.right)) {
          const old = p.left!.value;
          p.left = rotate(p.left!, "left");
          snap(
            "LR：先左旋左孩子",
            `先提升 ${p.left.value}，原左孩子 ${old} 下移；再右旋 ${p.value}。`,
            "左子树的右侧更高，直接一次右旋不能修复折线。",
            "这是双旋的中间态，暂不要求全树平衡。",
          );
        }
        turn(
          "right",
          "右旋修复平衡",
          `BF(${p.value})=${b}，左侧更高；把高的一侧向上提。`,
        );
      } else if (b < -1) {
        if (h(p.right!.right) < h(p.right!.left)) {
          const old = p.right!.value;
          p.right = rotate(p.right!, "right");
          snap(
            "RL：先右旋右孩子",
            `先提升 ${p.right.value}，原右孩子 ${old} 下移；再左旋 ${p.value}。`,
            "右子树的左侧更高，需要先把折线拉直。",
            "这是双旋的中间态。",
          );
        }
        turn("left", "左旋修复平衡", `BF(${p.value})=${b}，右侧更高。`);
      }
    } else {
      if (p.right?.red && !p.left?.red)
        turn(
          "left",
          "左旋红链接",
          "左倾红黑树要求红链接靠左；右红左黑时进行左旋。",
        );
      if (p.left?.red && p.left.left?.red)
        turn(
          "right",
          "右旋连续红链接",
          "连续两条左红链接等价于临时不合法的 4 节点形状。",
        );
      if (p.left?.red && p.right?.red) {
        p.red = !p.red;
        p.left.red = false;
        p.right.red = false;
        snap(
          "颜色翻转",
          `节点 ${p.value} 向上合并红链接，两孩子转黑。`,
          "把临时 4 节点拆开；可能把冲突传给父节点。",
          "根在本次插入结束时统一转黑，中间态根允许为红。",
        );
      }
    }
    update(p);
    attach(p);
    return p;
  };
  snap(
    "准备插入",
    values.join(" → "),
    "先预测下一个键的搜索路径，再观察修复。",
    "空树满足搜索树性质。",
    false,
  );
  values.forEach((v, i) => {
    cursor = i;
    insert(root, v, (q) => {
      root = q;
    });
    if (!avl) root!.red = false;
    snap(
      "插入后的完整树",
      `完成 ${v} 的插入与修复。`,
      avl
        ? "修复从叶到根更新高度，只有必要的祖先旋转。"
        : "根转黑完成本轮左倾红黑树修复。",
      avl
        ? "所有节点 |BF|≤1，且左小右大。"
        : "根黑、无连续红节点、无右红链接、各条根到空叶的黑高相同。",
      true,
      true,
    );
  });
  return {
    frames,
    kind: "graph",
    result: root,
    caption: avl
      ? "完整 AVL 树；BF=左高−右高，空树高 0。橙色仅表示暂时失衡。"
      : "完整左倾红黑树（LLRB）插入；橙色=红节点。中间态可能暂时违反平衡性质。",
  };
}

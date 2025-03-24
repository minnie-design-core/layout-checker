// Variable이 적용되지 않은 컬러 노드를 검색하고 표시하는 플러그인
figma.showUI(__html__, { width: 400, height: 560 });

// 노드가 Variable이 적용되지 않은 컬러 속성을 가지고 있는지 확인하는 함수
function hasNonVariableColorProperty(node: BaseNode): boolean {
  // 페인트 속성을 가질 수 있는 타입 확인
  if ('fills' in node) {
    const fillsNode = node as GeometryMixin;
    if (fillsNode.fills && Array.isArray(fillsNode.fills)) {
      for (const fill of fillsNode.fills) {
        // SOLID 타입이고 컬러를 가지며 Variable이 없는 경우만 찾음
        if (fill.type === 'SOLID' && 'color' in fill) {
          // boundVariables가 없거나 color 속성에 Variable이 없는 경우
          if (!('boundVariables' in fill) || 
              !(fill.boundVariables && 'color' in fill.boundVariables)) {
            return true;
          }
        }
      }
    }
  }
  
  // 스트로크 속성 확인
  if ('strokes' in node) {
    const strokesNode = node as GeometryMixin;
    if (strokesNode.strokes && Array.isArray(strokesNode.strokes)) {
      for (const stroke of strokesNode.strokes) {
        // SOLID 타입이고 컬러를 가지며 Variable이 없는 경우만 찾음
        if (stroke.type === 'SOLID' && 'color' in stroke) {
          // boundVariables가 없거나 color 속성에 Variable이 없는 경우
          if (!('boundVariables' in stroke) || 
              !(stroke.boundVariables && 'color' in stroke.boundVariables)) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// 노드의 Variable이 적용되지 않은 컬러 정보를 추출하는 함수
function getNonVariableColorInfo(node: BaseNode): any[] {
  const colorInfo: any[] = [];
  
  if ('fills' in node) {
    const fillsNode = node as GeometryMixin;
    if (fillsNode.fills && Array.isArray(fillsNode.fills)) {
      fillsNode.fills.forEach((fill, index) => {
        if (fill.type === 'SOLID' && 'color' in fill) {
          // Variable이 적용되지 않은 컬러만 추가
          if (!('boundVariables' in fill) || 
              !(fill.boundVariables && 'color' in fill.boundVariables)) {
            const color = fill.color;
            colorInfo.push({
              type: 'fill',
              index,
              color: {
                r: color.r,
                g: color.g,
                b: color.b,
                opacity: 'opacity' in fill ? fill.opacity : 1
              }
            });
          }
        }
      });
    }
  }
  
  if ('strokes' in node) {
    const strokesNode = node as GeometryMixin;
    if (strokesNode.strokes && Array.isArray(strokesNode.strokes)) {
      strokesNode.strokes.forEach((stroke, index) => {
        if (stroke.type === 'SOLID' && 'color' in stroke) {
          // Variable이 적용되지 않은 컬러만 추가
          if (!('boundVariables' in stroke) || 
              !(stroke.boundVariables && 'color' in stroke.boundVariables)) {
            const color = stroke.color;
            colorInfo.push({
              type: 'stroke',
              index,
              color: {
                r: color.r,
                g: color.g,
                b: color.b,
                opacity: 'opacity' in stroke ? stroke.opacity : 1
              }
            });
          }
        }
      });
    }
  }
  
  return colorInfo;
}

// 현재 페이지의 모든 노드를 재귀적으로 순회하는 함수
function traverseNodes(node: BaseNode, colorNodes: any[] = [], excludeHidden: boolean = false) {
  // 숨겨진 노드 확인
  if (excludeHidden && 'visible' in node && !node.visible) {
    return colorNodes; // 숨겨진 노드면 건너뜀
  }
  
  // 자식 노드 탐색
  if ('children' in node) {
    const container = node as ChildrenMixin;
    for (const child of container.children) {
      traverseNodes(child, colorNodes, excludeHidden);
    }
  }
  
  // 현재 노드에 Variable이 적용되지 않은 컬러 속성이 있는지 확인
  if (hasNonVariableColorProperty(node)) {
    const colorInfo = getNonVariableColorInfo(node);
    if (colorInfo.length > 0) {
      colorNodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        colors: colorInfo,
        visible: 'visible' in node ? node.visible : true
      });
    }
  }
  
  return colorNodes;
}

// 선택한 노드와 그 하위 노드들만 검사하는 함수
function searchSelectedNodes(excludeHidden: boolean = false): any[] {
  const selectedNodes = figma.currentPage.selection;
  
  if (selectedNodes.length === 0) {
    // 선택된 노드가 없는 경우 빈 배열 반환
    return [];
  }
  
  let colorNodes: any[] = [];
  
  // 선택된 각 노드와 그 하위 노드들을 검사
  selectedNodes.forEach(node => {
    colorNodes = traverseNodes(node, colorNodes, excludeHidden);
  });
  
  return colorNodes;
}

// 메시지 핸들러 설정
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'search-color-nodes') {
    // 옵션 값 가져오기
    const excludeHidden = msg.excludeHidden || false;
    const selectedNodesOnly = msg.selectedNodesOnly || false;
    
    let colorNodes: any[] = [];
    
    if (selectedNodesOnly) {
      // 선택한 노드만 검사
      colorNodes = searchSelectedNodes(excludeHidden);
      
      // 선택된 노드가 없는 경우 알림
      if (colorNodes.length === 0 && figma.currentPage.selection.length === 0) {
        figma.ui.postMessage({
          type: 'no-selection',
          message: '선택한 노드가 없습니다. 먼저 노드를 선택하세요.'
        });
        return;
      }
    } else {
      // 전체 페이지 검사
      colorNodes = traverseNodes(figma.currentPage, [], excludeHidden);
    }
    
    // UI에 결과 전송
    figma.ui.postMessage({
      type: 'color-nodes-result',
      nodes: colorNodes,
      selectedNodesOnly: selectedNodesOnly
    });
  }
  
  else if (msg.type === 'focus-node') {
    // 특정 노드에 포커스
    const nodeId = msg.nodeId;
    const node = figma.getNodeById(nodeId);
    
    if (node) {
      // 노드가 존재하면 선택하고 뷰포트 조정
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      
      // UI에 선택된 노드 정보 전송
      figma.ui.postMessage({
        type: 'node-focused',
        nodeId
      });
    }
  }
  
  else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
}; 
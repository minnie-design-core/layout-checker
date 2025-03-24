// 선택된 노드 안의 디자인이 오토 레이아웃을 활용한 Responsive Design을 잘 적용하고 있는지 검사하는 플러그인
figma.showUI(__html__, { width: 400, height: 560 });

// 오토 레이아웃 적용 상태를 확인하는 함수
function checkAutoLayout(node: SceneNode): any {
  let issues: any[] = [];
  
  // FRAME, COMPONENT, INSTANCE, COMPONENT_SET에만 오토 레이아웃 적용 가능
  if (
    node.type === 'FRAME' || 
    node.type === 'COMPONENT' || 
    node.type === 'INSTANCE' || 
    node.type === 'COMPONENT_SET'
  ) {
    const frameNode = node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode;
    
    // 오토 레이아웃이 적용되지 않은 경우
    if (frameNode.layoutMode === 'NONE') {
      issues.push({
        type: 'NO_AUTO_LAYOUT',
        message: '오토 레이아웃이 적용되지 않았습니다. 반응형 디자인을 위해 오토 레이아웃을 적용하세요.'
      });
    } else {
      // 오토 레이아웃은 적용되어 있지만 추가 검사
      
      // 1. 고정 크기 사용 여부 확인
      if (frameNode.primaryAxisSizingMode === 'FIXED') {
        issues.push({
          type: 'FIXED_PRIMARY_AXIS',
          message: '주 축(Primary Axis)이 고정 크기로 설정되어 있습니다. 반응형을 위해 "Hug contents" 또는 "Fill container"로 변경하세요.'
        });
      }
      
      if (frameNode.counterAxisSizingMode === 'FIXED') {
        issues.push({
          type: 'FIXED_COUNTER_AXIS',
          message: '보조 축(Counter Axis)이 고정 크기로 설정되어 있습니다. 반응형을 위해 "Hug contents" 또는 "Fill container"로 변경하세요.'
        });
      }
    }
  }
  
  // GROUP은 오토 레이아웃을 지원하지 않으므로 이슈로 표시
  if (node.type === 'GROUP' && 'children' in node && node.children.length > 1) {
    issues.push({
      type: 'GROUP_NOT_FRAME',
      message: '그룹 대신 프레임과 오토 레이아웃을 사용하세요. 그룹은 반응형 디자인을 지원하지 않습니다.'
    });
  }
  
  // 고정된 위치(Absolute position) 확인
  if ('parent' in node && node.parent && 
      ('layoutMode' in node.parent) && 
      node.parent.layoutMode !== 'NONE') {
    
    if ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE') {
      issues.push({
        type: 'ABSOLUTE_POSITION',
        message: '오토 레이아웃 내에서 절대 위치가 사용되었습니다. 반응형을 위해 상대적 배치를 사용하세요.'
      });
    }
  }

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    issues: issues,
    hasIssues: issues.length > 0
  };
}

// 노드 및 그 자식 노드들을 재귀적으로 검사하는 함수
function traverseNodes(node: SceneNode, results: any[] = [], excludeHidden: boolean = false) {
  // 숨겨진 노드 건너뛰기
  if (excludeHidden && !node.visible) {
    return results;
  }
  
  // 'icon_' 프리픽스를 가진 노드 건너뛰기
  if (node.name.startsWith('icon_')) {
    return results;
  }
  
  // 현재 노드 검사
  const checkResult = checkAutoLayout(node);
  if (checkResult.hasIssues) {
    results.push(checkResult);
  }
  
  // 자식 노드가 있는 경우 재귀적으로 검사
  if ('children' in node) {
    const container = node as ChildrenMixin & SceneNode;
    for (const child of container.children) {
      traverseNodes(child as SceneNode, results, excludeHidden);
    }
  }
  
  return results;
}

// 선택한 노드만 검사하는 함수
function checkSelectedNodes(excludeHidden: boolean = false): any[] {
  const selectedNodes = figma.currentPage.selection;
  
  if (selectedNodes.length === 0) {
    return [];
  }
  
  let results: any[] = [];
  
  // 선택된 각 노드와 그 하위 노드들을 검사
  selectedNodes.forEach(node => {
    results = traverseNodes(node, results, excludeHidden);
  });
  
  return results;
}

// 이슈 타입별 수정 함수
async function fixIssueByType(nodeId: string, issueType: string): Promise<boolean> {
  const node = figma.getNodeById(nodeId) as SceneNode;
  if (!node) return false;

  try {
    switch (issueType) {
      case 'NO_AUTO_LAYOUT':
        if (node.type === 'FRAME') {
          const frameNode = node as FrameNode;
          frameNode.layoutMode = 'VERTICAL';
          frameNode.primaryAxisSizingMode = 'AUTO';
          frameNode.counterAxisSizingMode = 'AUTO';
          return true;
        }
        break;

      case 'FIXED_PRIMARY_AXIS':
        if ('primaryAxisSizingMode' in node) {
          (node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode).primaryAxisSizingMode = 'AUTO';
          return true;
        }
        break;

      case 'FIXED_COUNTER_AXIS':
        if ('counterAxisSizingMode' in node) {
          (node as FrameNode | ComponentNode | InstanceNode | ComponentSetNode).counterAxisSizingMode = 'AUTO';
          return true;
        }
        break;

      case 'GROUP_NOT_FRAME':
        if (node.type === 'GROUP' && 'children' in node && node.children.length > 0) {
          // 새 프레임 생성
          const newFrame = figma.createFrame();
          newFrame.name = node.name;
          newFrame.layoutMode = 'VERTICAL';
          newFrame.primaryAxisSizingMode = 'AUTO';
          newFrame.counterAxisSizingMode = 'AUTO';
          newFrame.x = node.x;
          newFrame.y = node.y;
          newFrame.resize(node.width, node.height);
          
          // 그룹의 모든 자식을 새 프레임으로 이동
          while (node.children.length > 0) {
            const child = node.children[0];
            newFrame.appendChild(child);
          }
          
          // 그룹을 새 프레임으로 대체
          if (node.parent) {
            const index = node.parent.children.indexOf(node);
            if (index !== -1) {
              node.parent.insertChild(index, newFrame);
              node.remove();
              return true;
            }
          }
        }
        break;

      case 'ABSOLUTE_POSITION':
        if ('layoutPositioning' in node) {
          node.layoutPositioning = 'AUTO';
          return true;
        }
        break;
    }
  } catch (error) {
    console.error('이슈 수정 중 오류:', error);
  }
  
  return false;
}

// 메시지 핸들러 설정
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'check-auto-layout') {
    // 옵션 값 가져오기
    const excludeHidden = msg.excludeHidden || false;
    
    // 선택한 노드 검사
    const results = checkSelectedNodes(excludeHidden);
    
    // 선택된 노드가 없는 경우 알림
    if (figma.currentPage.selection.length === 0) {
      figma.ui.postMessage({
        type: 'no-selection',
        message: '선택한 노드가 없습니다. 먼저 노드를 선택하세요.'
      });
      return;
    }
    
    // UI에 결과 전송
    figma.ui.postMessage({
      type: 'auto-layout-results',
      results: results
    });
  }
  
  else if (msg.type === 'fix-issue') {
    const { nodeId, issueType } = msg;
    
    // 이슈 수정 시도
    const success = await fixIssueByType(nodeId, issueType);
    
    if (success) {
      // 수정 성공 시 해당 노드 선택
      const node = figma.getNodeById(nodeId);
      if (node) {
        figma.currentPage.selection = [node as SceneNode];
        figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      }
      
      // 수정 완료 메시지 전송
      figma.ui.postMessage({
        type: 'issue-fixed',
        nodeId,
        issueType
      });
    } else {
      // 수정 실패 메시지 전송
      figma.ui.postMessage({
        type: 'fix-failed',
        message: '이슈 수정에 실패했습니다.'
      });
    }
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
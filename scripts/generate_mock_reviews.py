"""生成100条真实风格的模拟评论数据."""

import csv
import random

PRODUCTS = [
    "T恤", "牛仔裤", "连衣裙", "运动鞋", "蓝牙耳机", "手机壳", "保温杯",
    "面膜", "口红", "零食大礼包", "电动牙刷", "充电宝", "瑜伽垫", "抱枕",
    "洗发露", "鼠标", "键盘", "台灯", "背包", "墨镜"
]

# 真实评论模板池，覆盖各种场景
def generate_reviews(n=100):
    reviews = []
    
    templates = [
        # 好评 - 详细
        "这款{product}真的超出预期！{detail}，{detail2}。已经推荐给闺蜜了，会回购！",
        "买给{recipient}的，{recipient}说{feedback}。{detail}，这个价格很值。",
        "第二次买了，{detail}。上次买的用了{duration}还很好，这次囤货。",
        "快递{speed}，包装{packaging}。{product}本身{detail}，{detail2}。满意！",
        "{product}的{feature}真的绝了，{detail}。虽然{minor_issue}，但不影响使用。",
        
        # 好评 - 简短口语
        "不错，{detail}",
        "挺好的，{recipient}喜欢",
        "可以可以，{detail}",
        "爱了爱了❤️ {detail}",
        "呜呜呜这个{product}太好用了吧",
        "种草成功！{detail}",
        "安利给大家，{detail}",
        
        # 中性/一般
        "还行吧，{detail}，反正对得起这个价格",
        "一般般，{detail}，没有想象中那么好",
        "凑合用，{minor_issue}，不过{detail}",
        "无功无过，{detail}，同价位有更好的选择",
        "就...还行？{detail}，不知道说什么好",
        
        # 差评 - 具体问题
        "踩雷了！{detail}，跟描述完全不符。{complaint}",
        "很差劲，{detail}，{detail2}。已经申请退货了。",
        "{product}质量{quality_adj}，{detail}。再也不买这家了。",
        "失望，{detail}，{minor_issue}就算了，{major_issue}真的忍不了。",
        "别买！{detail}，客服还{service_issue}。",
        
        # 差评 - 情绪化
        "垃圾！！！{complaint}",
        "什么玩意儿...{detail}，白花钱",
        "气死我了{detail}",
        "无语，{detail}",
        
        # 模糊/简短
        "还行",
        "可以",
        "一般",
        "好用",
        "不好用",
        "不错",
        "差",
        "好",
        
        # 转折句
        "虽然{detail}，但是{detail2}，整体来说{summary}",
        "{product}确实{detail}，不过{minor_issue}有点烦人",
        "一开始觉得{first_impression}，用了{duration}后发现{detail}",
        
        # 复杂场景
        "{product}和图片描述{match_adj}，{detail}。物流{speed}，快递员{delivery_feedback}。",
        "买了{quantity}个，第一个{detail}，第二个{detail2}。品控{quality_ctrl}。",
        "{recipient}生日送的，{recipient}{feedback}。包装{packaging}，适合送礼。",
        
        # 疑似刷单/模板
        "非常满意，物流很快，服务态度很好，好评！",
        "东西收到了，质量很好，卖家态度很好，给五星好评！",
        "商品不错，物流给力，客服热情，推荐购买！",
        
        # 语无伦次/打字错误
        "这个{product}呃...怎么说呢，{detail}吧反正",
        "{detail}，不知道在说什么了哈哈",
        "收到了，{detail}。哦对还有{detail2}。就这样。",
        
        # 极端短评
        "👍",
        "👎",
        "垃圾",
        "完美",
        "退钱",
        
        # 长评
        "终于收到心心念念的{product}了！{detail}，{detail2}。之前对比了好几家，最后选了这家，果然没失望。{detail}，性价比超高。包装{packaging}，送人自用都合适。已经安利给同事了，下次还会来！",
    ]
    
    details = [
        "面料很舒服", "做工精细", "颜色很正", "尺码标准", "穿着显白",
        "音质清晰", "续航能力不错", "手感很好", "没有异味", "材质厚实",
        "设计人性化", "操作方便", "外观高级", "功能齐全", "性价比很高",
        "防水效果好", "充电速度快", "佩戴舒适", "收纳方便", "清洁效果好",
        "味道很好闻", "质地轻薄", "不易脱妆", "刷毛很软", "亮度可调",
        "承重能力强", "分区合理", "防滑效果好", "回弹快", "没有色差",
    ]
    
    details2 = [
        "细节处理到位", "缝线整齐", "拉链顺滑", "按钮灵敏", "屏幕清晰",
        "连接稳定", "降噪效果明显", "保温时间长", "泡沫丰富", "上色均匀",
        "震感适中", "指示明确", "角度可调", "背带舒适", "镜片清晰",
    ]
    
    minor_issues = [
        "有点线头", "味道有点大", "颜色偏深", "尺码偏小", "包装有点简陋",
        "快递有点慢", "客服回复慢", "说明书看不懂", "充电线有点短", "稍微有点重",
    ]
    
    major_issues = [
        "用了两天就坏了", "严重掉色", "开裂了", "根本充不进电", "有安全隐患",
        "假货", "与描述完全不符", "质量太差", "漏液", "有异响",
    ]
    
    complaints = [
        "要求退货", "客服不理人", "浪费钱", "再也不会买了", "差评到底",
    ]
    
    service_issues = [
        "态度恶劣", "推卸责任", "已读不回", "拒绝退货", "敷衍了事",
    ]
    
    recipients = ["妈妈", "男朋友", "女朋友", "孩子", "自己", "闺蜜", "同事", "爸爸"]
    
    feedbacks = [
        "很喜欢", "说不错", "夸我有眼光", "很满意", "天天在用",
        "觉得一般", "不是很喜欢", "说颜色太艳", "嫌大了", "说挺好",
    ]
    
    speeds = ["很快", "隔天到", "三天才到", "慢死了", "正常速度"]
    
    packagings = ["严实", "精美", "有点简陋", "完好无损", "礼盒装很高档"]
    
    features = [
        "设计", "质感", "功能", "颜值", "做工", "包装", "服务", "性价比",
    ]
    
    durations = ["一周", "一个月", "三个月", "半年", "一年"]
    
    quality_adjs = ["堪忧", "不行", "太差", "一般般", "配不上价格"]
    
    match_adjs = ["一致", "有点色差", "差不多", "比图片好看", "没有图片好看"]
    
    delivery_feedbacks = ["态度好", "送货上门", "直接放驿站", "打电话通知", "没通知"]
    
    quantities = ["两", "三"]
    
    quality_ctrls = ["不太稳定", "还行", "差距不大", "需要加强", "看运气"]
    
    summaries = ["还是推荐的", "可以考虑", "一般吧", "不太值", "超出预期"]
    
    first_impressions = ["一般", "挺好看的", "感觉不太行", "期待很高", "有点失望"]
    
    used = set()
    
    for i in range(n):
        # 确保多样化：不重复使用完全相同的评论
        attempts = 0
        while attempts < 50:
            template = random.choice(templates)
            product = random.choice(PRODUCTS)
            
            content = template.format(
                product=product,
                detail=random.choice(details),
                detail2=random.choice(details2),
                minor_issue=random.choice(minor_issues),
                major_issue=random.choice(major_issues),
                complaint=random.choice(complaints),
                service_issue=random.choice(service_issues),
                recipient=random.choice(recipients),
                feedback=random.choice(feedbacks),
                speed=random.choice(speeds),
                packaging=random.choice(packagings),
                feature=random.choice(features),
                duration=random.choice(durations),
                quality_adj=random.choice(quality_adjs),
                match_adj=random.choice(match_adjs),
                delivery_feedback=random.choice(delivery_feedbacks),
                quantity=random.choice(quantities),
                quality_ctrl=random.choice(quality_ctrls),
                summary=random.choice(summaries),
                first_impression=random.choice(first_impressions),
            )
            
            if content not in used:
                used.add(content)
                break
            attempts += 1
        
        # 随机添加一些口语化、不完美的元素
        if random.random() < 0.15:
            content = content.replace("，", ",").replace("。", ".")
        if random.random() < 0.1:
            content = content.replace("很", "hin") if random.random() < 0.3 else content
        if random.random() < 0.08:
            content += random.choice(["哈哈哈", "无语了", "emm", "...", "笑死", "哎"])
        if random.random() < 0.05:
            content = content.replace("什么", "啥")
        
        # 评分逻辑
        if "垃圾" in content or "差" in content or "退货" in content or "踩雷" in content or "别买" in content:
            rating = random.choice([1, 1, 1, 2])
        elif "还行" in content or "一般" in content or "凑合" in content:
            rating = random.choice([3, 3, 4])
        elif "不错" in content or "好" in content or "喜欢" in content or "推荐" in content:
            rating = random.choice([4, 5, 5, 5])
        elif len(content) < 5:
            rating = random.choice([1, 2, 3, 4, 5])
        else:
            rating = random.choice([3, 4, 4, 5, 5])
        
        reviews.append({
            "评论ID": f"R{i+1:03d}",
            "评论内容": content,
            "评分": rating,
            "商品名称": product,
        })
    
    return reviews


if __name__ == "__main__":
    reviews = generate_reviews(100)
    
    output_path = "data/samples/reviews_100.csv"
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["评论ID", "评论内容", "评分", "商品名称"])
        writer.writeheader()
        writer.writerows(reviews)
    
    print(f"已生成 {len(reviews)} 条模拟评论: {output_path}")
    
    # 统计
    lengths = [len(r["评论内容"]) for r in reviews]
    ratings = [r["评分"] for r in reviews]
    print(f"评论长度: min={min(lengths)}, max={max(lengths)}, avg={sum(lengths)//len(lengths)}")
    print(f"评分分布: 1星={ratings.count(1)}, 2星={ratings.count(2)}, 3星={ratings.count(3)}, 4星={ratings.count(4)}, 5星={ratings.count(5)}")

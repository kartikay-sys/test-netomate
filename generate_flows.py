import json
import random

original_flows = [
  {
    "flow_id": "flow_0",
    "source_script": "TC_9_2_S6a_MME_HSS.py",
    "sequence": [
      "search_pcap_file", "reset_all_mobiles", "connect_mobile", "capture_device_health",
      "check_radio", "packet_capture_start", "mo_detach", "packet_capture_stop",
      "mo_attach", "packet_capture_stop", "search_pcap_file", "pcap_parser", "disconnect_mobile"
    ]
  },
  {
    "flow_id": "flow_1",
    "source_script": "TC_24_Support_of_Multiple_Bearers.py",
    "sequence": [
      "search_pcap_file", "reset_all_mobiles", "connect_mobile", "capture_device_health",
      "connect_mobile", "capture_device_health", "check_radio", "packet_capture_start",
      "mo_mt_voice_call_start", "epcems_login", "epcems_capture_subscriber_details", "epcems_logout",
      "mo_mt_voice_terminate_call", "packet_capture_stop", "search_pcap_file", "pcap_parser", "disconnect_mobile"
    ]
  },
  {
    "flow_id": "flow_2",
    "source_script": "TC_16_Check_LBS_integration.py",
    "sequence": [
      "epcems_login", "epcems_capture_sls_peer_info", "epcems_logout",
      "search_pcap_file", "reset_all_mobiles", "connect_mobile", "capture_device_health",
      "check_radio", "packet_capture_start", "mo_detach", "packet_capture_stop",
      "mo_attach", "packet_capture_stop", "search_pcap_file", "pcap_parser", "disconnect_mobile"
    ]
  },
  {
    "flow_id": "flow_24",
    "source_script": "TC_ems_node_monitoring.py",
    "sequence": [
      "epcems_login", "epcems_capture_node_alarms", "epcems_capture_node_snmp_check",
      "epcems_capture_performance_monitoring", "epcems_capture_resource_stats_reports", "epcems_logout"
    ]
  },
  {
    "flow_id": "flow_25",
    "source_script": "TC_ems_peer_validation.py",
    "sequence": [
      "epcems_login", "epcems_capture_active_peer", "epcems_capture_sls_peer_info",
      "epcems_capture_li_self_info", "epcems_logout"
    ]
  }
]

# Building blocks based on patterns
mobile_setup = ["search_pcap_file", "reset_all_mobiles", "connect_mobile", "capture_device_health", "check_radio"]
mobile_cleanup = ["search_pcap_file", "pcap_parser", "disconnect_mobile"]
mobile_actions = [
    ["mo_detach", "mo_attach"],
    ["mo_mt_voice_call_start", "mo_mt_voice_terminate_call"],
    ["mo_speed_test"],
    ["mo_sms_send", "mo_sms_receive"],
    ["mo_data_session_start", "mo_data_session_stop"],
    ["mo_volte_call_start", "mo_volte_call_stop"]
]
epc_actions = [
    "epcems_capture_node_alarms", "epcems_capture_node_snmp_check",
    "epcems_capture_performance_monitoring", "epcems_capture_resource_stats_reports",
    "epcems_capture_active_peer", "epcems_capture_sls_peer_info",
    "epcems_capture_li_self_info", "epcems_capture_subscriber_details",
    "epcems_capture_device_status"
]

generated_flows = list(original_flows)
random.seed(42)  # For consistent reproducible logic

for i in range(26, 61):  # Generate 35 more flows to reach 40 total
    flow_type = random.choice(["mobile", "epc", "hybrid"])
    sequence = []
    
    if flow_type == "epc":
        sequence.append("epcems_login")
        num_actions = random.randint(1, 4)
        sequence.extend(random.sample(epc_actions, num_actions))
        sequence.append("epcems_logout")
        source = f"TC_ems_generated_{i}.py"
        
    elif flow_type == "mobile":
        sequence.extend(mobile_setup)
        sequence.append("packet_capture_start")
        action = random.choice(mobile_actions)
        sequence.extend(action)
        sequence.append("packet_capture_stop")
        sequence.extend(mobile_cleanup)
        source = f"TC_mobile_generated_{i}.py"
        
    else: # hybrid
        if random.random() > 0.5:
            # EPC first
            sequence.append("epcems_login")
            sequence.append(random.choice(epc_actions))
            sequence.append("epcems_logout")
            sequence.extend(mobile_setup)
            sequence.append("packet_capture_start")
            sequence.extend(random.choice(mobile_actions))
            sequence.append("packet_capture_stop")
            sequence.extend(mobile_cleanup)
            source = f"TC_hybrid_epc_first_{i}.py"
        else:
            # Mobile around EPC
            sequence.extend(mobile_setup)
            sequence.append("packet_capture_start")
            sequence.append("mo_mt_voice_call_start")
            sequence.append("epcems_login")
            sequence.append("epcems_capture_subscriber_details")
            sequence.append("epcems_logout")
            sequence.append("mo_mt_voice_terminate_call")
            sequence.append("packet_capture_stop")
            sequence.extend(mobile_cleanup)
            source = f"TC_hybrid_mobile_wrap_{i}.py"

    generated_flows.append({
        "flow_id": f"flow_{i}",
        "source_script": source,
        "sequence": sequence
    })

with open("e:/NETOMATE/synthetic_flows_dataset.json", "w") as f:
    json.dump(generated_flows, f, indent=4)

print("Generated 40 flows successfully to synthetic_flows_dataset.json")
